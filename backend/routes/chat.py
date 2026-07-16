"""AI chat routes — proxies to the user's configured open-source LLM provider.

Supported wire formats:
  - Ollama native  (POST {base}/api/chat)             for provider="ollama"
  - OpenAI-compat  (POST {base}/chat/completions)     for openrouter, vllm, lm_studio, llama_cpp

The provider itself is defined in user Settings; no keys are stored server-side.
Requests time out at 60s; errors bubble back as 502 with a friendly message.

The Decision Engine (services/decision_engine.py) augments each request with:
  - Relevant memories from the user's personal store.
  - A DuckDuckGo snippet when the query looks time-sensitive or explicitly asks
    the model to search the web.
"""
import uuid
import json
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from core.database import get_db
from core.deps import get_current_user
from pydantic import BaseModel, Field
from services.decision_engine import (
    compose_augmented_messages, duckduckgo_snippet, relevant_memories, uses_memory, wants_web,
)

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant|system)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    save_history: bool = True


class ChatResponse(BaseModel):
    reply: str
    provider: str
    model: str
    history_id: str | None = None
    sources: list[str] = []


async def _get_provider_config(user_id: str) -> dict[str, Any]:
    db = get_db()
    s = await db.settings.find_one({"user_id": user_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=400, detail="Settings not configured")
    return {
        "provider": s.get("ai_provider", "ollama"),
        "base_url": (s.get("ai_provider_base_url") or "").rstrip("/"),
        "model": s.get("ai_provider_model") or "",
    }


async def _call_ollama(base: str, model: str, messages: list[dict]) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{base}/api/chat",
            json={"model": model, "messages": messages, "stream": False},
        )
        r.raise_for_status()
        data = r.json()
        return (data.get("message") or {}).get("content", "") or data.get("response", "")


async def _call_openai_compat(base: str, model: str, messages: list[dict]) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{base}/chat/completions",
            json={"model": model, "messages": messages, "stream": False},
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()
        data = r.json()
        choices = data.get("choices") or []
        if not choices:
            return ""
        return (choices[0].get("message") or {}).get("content", "")


async def _stream_ollama(base: str, model: str, messages: list[dict]):
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST", f"{base}/api/chat",
            json={"model": model, "messages": messages, "stream": True},
        ) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                chunk = (data.get("message") or {}).get("content", "")
                if chunk:
                    yield chunk
                if data.get("done"):
                    break


async def _stream_openai_compat(base: str, model: str, messages: list[dict]):
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST", f"{base}/chat/completions",
            json={"model": model, "messages": messages, "stream": True},
            headers={"Content-Type": "application/json"},
        ) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                payload = line[len("data:"):].strip()
                if payload == "[DONE]":
                    break
                try:
                    data = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                choices = data.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                chunk = delta.get("content", "")
                if chunk:
                    yield chunk


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest, user: dict = Depends(get_current_user)):
    cfg = await _get_provider_config(user["user_id"])
    if not cfg["base_url"] or not cfg["model"]:
        raise HTTPException(
            status_code=400,
            detail="AI provider not configured. Set base URL and model in Settings.",
        )

    payload = [m.model_dump() for m in body.messages]

    # ---- Decision Engine ----
    last_user = next((m.content for m in reversed(body.messages) if m.role == "user"), "")
    db = get_db()
    sources: list[str] = ["context"]
    memories: list[dict] = []
    web_snippet: str | None = None
    if last_user and uses_memory(last_user):
        memories = await relevant_memories(db, user["user_id"], last_user)
        if memories:
            sources.append("memory")
    if last_user and wants_web(last_user):
        web_snippet = await duckduckgo_snippet(last_user)
        if web_snippet:
            sources.append("web")

    augmented = compose_augmented_messages(payload, memories, web_snippet, user.get("name", ""))
    sources.append("ai")

    try:
        if cfg["provider"] == "ollama":
            reply = await _call_ollama(cfg["base_url"], cfg["model"], augmented)
        else:
            reply = await _call_openai_compat(cfg["base_url"], cfg["model"], augmented)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"AI provider error: {e}")

    reply = (reply or "").strip()
    if not reply:
        raise HTTPException(status_code=502, detail="AI provider returned empty response")

    history_id: str | None = None
    if body.save_history:
        db2 = get_db()
        history_id = f"hist_{uuid.uuid4().hex[:12]}"
        await db2.history.insert_one({
            "history_id": history_id,
            "user_id": user["user_id"],
            "title": (last_user[:60] or "Conversation") + ("…" if len(last_user) > 60 else ""),
            "snippet": reply[:140],
            "turns": len(body.messages) + 1,
            "sources": sources,
            "created_at": datetime.now(timezone.utc),
        })

    return ChatResponse(
        reply=reply,
        provider=cfg["provider"],
        model=cfg["model"],
        history_id=history_id,
        sources=sources,
    )


@router.post("/stream")
async def chat_stream(body: ChatRequest, user: dict = Depends(get_current_user)):
    """Streams the reply as plain text chunks as they're generated (real
    streaming — the old endpoint above always waited for the full reply).
    Uses a simple chunked text/plain body rather than full SSE framing so
    it works with React Native's XHR-based progressive reader, which does
    not reliably support the browser EventSource/ReadableStream APIs."""
    cfg = await _get_provider_config(user["user_id"])
    if not cfg["base_url"] or not cfg["model"]:
        raise HTTPException(
            status_code=400,
            detail="AI provider not configured. Set base URL and model in Settings.",
        )

    payload = [m.model_dump() for m in body.messages]
    last_user = next((m.content for m in reversed(body.messages) if m.role == "user"), "")
    db = get_db()
    memories: list[dict] = []
    web_snippet: str | None = None
    if last_user and uses_memory(last_user):
        memories = await relevant_memories(db, user["user_id"], last_user)
    if last_user and wants_web(last_user):
        web_snippet = await duckduckgo_snippet(last_user)
    augmented = compose_augmented_messages(payload, memories, web_snippet, user.get("name", ""))

    async def generate():
        collected: list[str] = []
        try:
            source = (
                _stream_ollama(cfg["base_url"], cfg["model"], augmented)
                if cfg["provider"] == "ollama"
                else _stream_openai_compat(cfg["base_url"], cfg["model"], augmented)
            )
            async for chunk in source:
                collected.append(chunk)
                yield chunk
        except httpx.HTTPError as e:
            yield f"\n\n[stream error: {e}]"
            return

        if body.save_history and collected:
            full_reply = "".join(collected).strip()
            db2 = get_db()
            await db2.history.insert_one({
                "history_id": f"hist_{uuid.uuid4().hex[:12]}",
                "user_id": user["user_id"],
                "title": (last_user[:60] or "Conversation") + ("…" if len(last_user) > 60 else ""),
                "snippet": full_reply[:140],
                "turns": len(body.messages) + 1,
                "sources": ["context", "ai"],
                "created_at": datetime.now(timezone.utc),
            })

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")

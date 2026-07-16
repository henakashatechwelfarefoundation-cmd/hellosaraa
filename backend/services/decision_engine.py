"""Decision Engine — Phase 3.

Chooses information source in this priority order (per the spec):
  1. Conversation context (already in the messages list)
  2. Personal memory (Sara's stored facts about the user)
  3. AI model
  4. Web search (only when the model likely doesn't know / user asked to search)

This module is pure orchestration — the actual LLM call lives in `routes/chat.py`.
"""
import re
from typing import Any

import httpx

from services.search import rank_by_relevance


MEMORY_KEYWORDS = re.compile(
    r"\b(my|mine|i\s+like|i\s+love|i\s+hate|i\s+prefer|i\s+work|i\s+live|i\s+am|remember)\b",
    re.IGNORECASE,
)

WEB_KEYWORDS = re.compile(
    r"\b(latest|today|news|weather|price|score|stock|current|search|google|look\s+up|find\s+out)\b",
    re.IGNORECASE,
)


def wants_web(query: str) -> bool:
    return bool(WEB_KEYWORDS.search(query))


def uses_memory(query: str) -> bool:
    return bool(MEMORY_KEYWORDS.search(query))


async def relevant_memories(db, user_id: str, query: str, limit: int = 6) -> list[dict]:
    """Return top memories whose title/content/tags overlap with the query,
    ranked by TF-IDF relevance (see services/search.py) rather than just
    "first N regex matches"."""
    words = [w for w in re.findall(r"\w{3,}", query.lower())][:5]
    if not words:
        return []
    ors: list[dict] = []
    for w in words:
        ors.extend([
            {"title": {"$regex": w, "$options": "i"}},
            {"content": {"$regex": w, "$options": "i"}},
            {"tags": {"$regex": w, "$options": "i"}},
        ])
    docs = await db.memories.find(
        {"user_id": user_id, "$or": ors}, {"_id": 0}
    ).limit(limit * 5).to_list(limit * 5)
    ranked = rank_by_relevance(query, docs, ("title", "content"))
    return ranked[:limit]


async def duckduckgo_snippet(query: str) -> str | None:
    """Fetch a short factual snippet from DuckDuckGo's Instant Answer API.

    Free, no key, no proprietary AI. Best-effort; returns None on failure.
    """
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
            )
            if r.status_code != 200:
                return None
            data: dict[str, Any] = r.json()
            abstract = data.get("AbstractText") or ""
            answer = data.get("Answer") or ""
            related = data.get("RelatedTopics") or []
            first = ""
            if related and isinstance(related, list):
                for item in related:
                    if isinstance(item, dict) and item.get("Text"):
                        first = item["Text"]
                        break
            snippet = abstract or answer or first
            return snippet.strip() or None
    except Exception:
        return None


def build_system_prompt(user_name: str) -> str:
    return (
        f"You are Sara, a warm and concise personal AI assistant for {user_name or 'the user'}. "
        "Reply directly and helpfully. Prefer short paragraphs and bullet lists over long prose. "
        "If you use information provided under [MEMORY] or [WEB], seamlessly weave it in "
        "without saying 'according to memory' — just answer."
    )


def compose_augmented_messages(
    base_messages: list[dict],
    memories: list[dict],
    web_snippet: str | None,
    user_name: str = "",
) -> list[dict]:
    """Prepend a system prompt + context blocks derived from Decision Engine output."""
    context_parts: list[str] = []
    if memories:
        mem_block = "\n".join(f"- {m['title']}: {m['content']}" for m in memories[:6])
        context_parts.append(f"[MEMORY]\n{mem_block}")
    if web_snippet:
        context_parts.append(f"[WEB]\n{web_snippet}")

    system = build_system_prompt(user_name)
    if context_parts:
        system += "\n\n" + "\n\n".join(context_parts)

    # Ensure exactly one system message at the top, followed by user messages.
    return [{"role": "system", "content": system}, *[
        m for m in base_messages if m.get("role") in ("user", "assistant")
    ]]

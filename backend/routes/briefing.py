"""Daily briefing — Phase 6 personal intelligence foundation.

Aggregates: upcoming reminders (next 24h), recent memories, recent history,
and a personalized greeting. This is *deterministic* aggregation — no AI calls.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.database import get_db
from core.deps import get_current_user

router = APIRouter(prefix="/briefing", tags=["briefing"])


class BriefingReminder(BaseModel):
    reminder_id: str
    title: str
    remind_at: datetime


class BriefingMemory(BaseModel):
    memory_id: str
    title: str


class BriefingHistory(BaseModel):
    history_id: str
    title: str
    created_at: datetime


class Briefing(BaseModel):
    greeting: str
    date: str
    reminders_today: list[BriefingReminder]
    recent_memories: list[BriefingMemory]
    recent_conversations: list[BriefingHistory]
    stats: dict


def _greeting(name: str) -> str:
    h = datetime.now(timezone.utc).hour
    slot = "morning" if h < 12 else "afternoon" if h < 18 else "evening"
    first = (name or "friend").split(" ")[0]
    return f"Good {slot}, {first}"


@router.get("", response_model=Briefing)
async def get_briefing(user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(hours=24)

    rems_docs = await db.reminders.find(
        {"user_id": user["user_id"], "remind_at": {"$gte": now, "$lte": horizon}, "completed": {"$ne": True}},
        {"_id": 0},
    ).sort("remind_at", 1).to_list(20)

    mems_docs = await db.memories.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(5)

    hist_docs = await db.history.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(5)

    total_mem = await db.memories.count_documents({"user_id": user["user_id"]})
    total_hist = await db.history.count_documents({"user_id": user["user_id"]})
    total_notes = await db.notes.count_documents({"user_id": user["user_id"]})

    return Briefing(
        greeting=_greeting(user.get("name", "")),
        date=now.strftime("%A, %b %d"),
        reminders_today=[BriefingReminder(**{k: r[k] for k in ("reminder_id", "title", "remind_at")}) for r in rems_docs],
        recent_memories=[BriefingMemory(**{k: m[k] for k in ("memory_id", "title")}) for m in mems_docs],
        recent_conversations=[BriefingHistory(**{k: h[k] for k in ("history_id", "title", "created_at")}) for h in hist_docs],
        stats={"memories": total_mem, "conversations": total_hist, "notes": total_notes},
    )

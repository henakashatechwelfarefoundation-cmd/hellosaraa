"""Reminder routes."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from core.database import get_db
from core.deps import get_current_user
from models.schemas import Reminder, ReminderCreate

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("", response_model=list[Reminder])
async def list_reminders(user: dict = Depends(get_current_user)):
    db = get_db()
    items = await db.reminders.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("remind_at", 1).to_list(500)
    return [Reminder(**r) for r in items]


@router.post("", response_model=Reminder, status_code=status.HTTP_201_CREATED)
async def create_reminder(body: ReminderCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = {
        "reminder_id": f"rem_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "title": body.title,
        "notes": body.notes,
        "remind_at": body.remind_at,
        "completed": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.reminders.insert_one(dict(doc))
    return Reminder(**doc)


@router.delete("/{reminder_id}")
async def delete_reminder(reminder_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    result = await db.reminders.delete_one(
        {"reminder_id": reminder_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"success": True}

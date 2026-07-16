"""History routes — conversation log stubs (populated by future phases)."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.database import get_db
from core.deps import get_current_user
from models.schemas import HistoryCreate, HistoryItem

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=list[HistoryItem])
async def list_history(
    q: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {"user_id": user["user_id"]}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"snippet": {"$regex": q, "$options": "i"}},
        ]
    items = await db.history.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [HistoryItem(**h) for h in items]


@router.post("", response_model=HistoryItem, status_code=status.HTTP_201_CREATED)
async def create_history(body: HistoryCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = {
        "history_id": f"hist_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "title": body.title,
        "snippet": body.snippet,
        "turns": body.turns,
        "created_at": datetime.now(timezone.utc),
    }
    await db.history.insert_one(dict(doc))
    return HistoryItem(**doc)


@router.delete("/{history_id}")
async def delete_history(history_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    result = await db.history.delete_one({"history_id": history_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="History item not found")
    return {"success": True}


@router.delete("")
async def clear_history(user: dict = Depends(get_current_user)):
    db = get_db()
    await db.history.delete_many({"user_id": user["user_id"]})
    return {"success": True}

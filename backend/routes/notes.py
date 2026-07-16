"""Notes routes — Phase 5 productivity foundation."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.database import get_db
from core.deps import get_current_user

router = APIRouter(prefix="/notes", tags=["notes"])


class Note(BaseModel):
    note_id: str
    user_id: str
    title: str
    content: str
    tags: list[str] = []
    color: str = "purple"
    pinned: bool = False
    created_at: datetime
    updated_at: datetime


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    content: str = Field(min_length=1, max_length=20000)
    tags: list[str] = Field(default_factory=list)
    color: str = "purple"
    pinned: bool = False


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    tags: list[str] | None = None
    color: str | None = None
    pinned: bool | None = None


@router.get("", response_model=list[Note])
async def list_notes(q: str | None = Query(default=None), user: dict = Depends(get_current_user)):
    db = get_db()
    query: dict = {"user_id": user["user_id"]}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"content": {"$regex": q, "$options": "i"}},
        ]
    items = await db.notes.find(query, {"_id": 0}).sort([("pinned", -1), ("updated_at", -1)]).to_list(500)
    return [Note(**n) for n in items]


@router.post("", response_model=Note, status_code=status.HTTP_201_CREATED)
async def create_note(body: NoteCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = {
        "note_id": f"note_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "title": body.title,
        "content": body.content,
        "tags": body.tags,
        "color": body.color,
        "pinned": body.pinned,
        "created_at": now,
        "updated_at": now,
    }
    await db.notes.insert_one(dict(doc))
    return Note(**doc)


@router.patch("/{note_id}", response_model=Note)
async def update_note(note_id: str, body: NoteUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.notes.update_one(
        {"note_id": note_id, "user_id": user["user_id"]}, {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    fresh = await db.notes.find_one({"note_id": note_id}, {"_id": 0})
    return Note(**fresh)


@router.delete("/{note_id}")
async def delete_note(note_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    result = await db.notes.delete_one({"note_id": note_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"success": True}

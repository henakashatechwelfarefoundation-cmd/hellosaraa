"""Task routes — a real to-do list (was missing entirely before)."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.database import get_db
from core.deps import get_current_user
from models.schemas import Task, TaskCreate, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[Task])
async def list_tasks(
    completed: bool | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {"user_id": user["user_id"]}
    if completed is not None:
        query["completed"] = completed
    items = await db.tasks.find(query, {"_id": 0}).sort(
        [("completed", 1), ("due_at", 1), ("created_at", -1)]
    ).to_list(500)
    return [Task(**t) for t in items]


@router.post("", response_model=Task, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = {
        "task_id": f"task_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "title": body.title,
        "notes": body.notes,
        "due_at": body.due_at,
        "priority": body.priority,
        "completed": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.tasks.insert_one(dict(doc))
    return Task(**doc)


@router.patch("/{task_id}", response_model=Task)
async def update_task(task_id: str, body: TaskUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.tasks.update_one(
        {"task_id": task_id, "user_id": user["user_id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    fresh = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    return Task(**fresh)


@router.delete("/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    result = await db.tasks.delete_one({"task_id": task_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True}

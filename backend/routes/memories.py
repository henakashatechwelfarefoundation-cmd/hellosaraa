"""Memory routes — CRUD for user memories."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.database import get_db
from core.deps import get_current_user
from models.schemas import Memory, MemoryCreate, MemoryUpdate
from services.search import rank_by_relevance

router = APIRouter(prefix="/memories", tags=["memories"])


@router.get("", response_model=list[Memory])
async def list_memories(
    q: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {"user_id": user["user_id"]}
    if tag:
        query["tags"] = tag

    if q:
        # Cast a wide net (regex on title/content/tags, or just a broad
        # per-user pull if the regex misses due to wording differences),
        # then re-rank locally with TF-IDF so near-matches surface even
        # when they don't share an exact substring with the query.
        regex_query = dict(query)
        regex_query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"content": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
        candidates = await db.memories.find(regex_query, {"_id": 0}).to_list(500)
        if len(candidates) < 10:
            # Regex found little/nothing — widen to all of the user's
            # memories (still bounded) and let TF-IDF do the filtering.
            broader = await db.memories.find(query, {"_id": 0}).sort("created_at", -1).to_list(300)
            seen_ids = {c["memory_id"] for c in candidates}
            candidates.extend(m for m in broader if m["memory_id"] not in seen_ids)
        items = rank_by_relevance(q, candidates, ("title", "content"))
    else:
        items = await db.memories.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

    return [Memory(**m) for m in items]


@router.post("", response_model=Memory, status_code=status.HTTP_201_CREATED)
async def create_memory(body: MemoryCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = {
        "memory_id": f"mem_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "title": body.title,
        "content": body.content,
        "tags": body.tags,
        "created_at": now,
        "updated_at": now,
    }
    await db.memories.insert_one(dict(doc))
    return Memory(**doc)


@router.patch("/{memory_id}", response_model=Memory)
async def update_memory(memory_id: str, body: MemoryUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.memories.update_one(
        {"memory_id": memory_id, "user_id": user["user_id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Memory not found")
    fresh = await db.memories.find_one({"memory_id": memory_id}, {"_id": 0})
    return Memory(**fresh)


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    result = await db.memories.delete_one({"memory_id": memory_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"success": True}

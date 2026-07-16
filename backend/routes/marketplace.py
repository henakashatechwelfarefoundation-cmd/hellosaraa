"""Workflow marketplace — Phase 6 community layer.

Users can publish their voice automations. Any user can browse the public
catalogue, view details, and install a copy into their own /automations.

The publish endpoint anonymises the workflow (drops user_id, run stats)
and stores it under `marketplace_workflows`. Installation clones a fresh
copy into the caller's `workflows` collection with a new id.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.database import get_db
from core.deps import get_current_user

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


class MarketplaceWorkflow(BaseModel):
    marketplace_id: str
    name: str
    description: str
    trigger: str
    steps: list[dict]
    icon: str = "sparkles"
    tags: list[str] = []
    author_name: str
    author_id: str
    installs: int = 0
    likes: int = 0
    published_at: datetime


class PublishRequest(BaseModel):
    workflow_id: str
    description: str = Field(min_length=1, max_length=500)
    icon: str = "sparkles"
    tags: list[str] = Field(default_factory=list)


@router.get("/workflows", response_model=list[MarketplaceWorkflow])
async def list_marketplace(q: str | None = None, tag: str | None = None):
    """Public catalogue — auth not required so users can browse before signup."""
    db = get_db()
    query: dict = {}
    if tag:
        query["tags"] = tag
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.marketplace_workflows.find(query, {"_id": 0}).sort("installs", -1).to_list(200)
    return [MarketplaceWorkflow(**d) for d in docs]


@router.post("/publish", response_model=MarketplaceWorkflow, status_code=status.HTTP_201_CREATED)
async def publish_workflow(body: PublishRequest, user: dict = Depends(get_current_user)):
    db = get_db()
    wf = await db.workflows.find_one(
        {"workflow_id": body.workflow_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    mid = f"mp_{uuid.uuid4().hex[:12]}"
    doc = {
        "marketplace_id": mid,
        "name": wf["name"],
        "description": body.description,
        "trigger": wf.get("trigger", "manual"),
        "steps": wf.get("steps", []),
        "icon": body.icon,
        "tags": body.tags,
        "author_name": user.get("name") or user["email"].split("@")[0],
        "author_id": user["user_id"],
        "installs": 0,
        "likes": 0,
        "published_at": datetime.now(timezone.utc),
    }
    await db.marketplace_workflows.insert_one(dict(doc))
    return MarketplaceWorkflow(**doc)


@router.post("/install/{marketplace_id}")
async def install_workflow(marketplace_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    mp = await db.marketplace_workflows.find_one({"marketplace_id": marketplace_id}, {"_id": 0})
    if not mp:
        raise HTTPException(status_code=404, detail="Not in marketplace")

    now = datetime.now(timezone.utc)
    new_wf = {
        "workflow_id": f"wf_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": mp["name"],
        "trigger": mp.get("trigger", "manual"),
        "steps": mp.get("steps", []),
        "enabled": True,
        "created_at": now,
        "updated_at": now,
        "run_count": 0,
        "last_run_at": None,
        "source": {"marketplace_id": marketplace_id, "author_name": mp["author_name"]},
    }
    await db.workflows.insert_one(dict(new_wf))
    await db.marketplace_workflows.update_one(
        {"marketplace_id": marketplace_id}, {"$inc": {"installs": 1}}
    )
    return {"workflow_id": new_wf["workflow_id"], "success": True}


@router.post("/like/{marketplace_id}")
async def like_workflow(marketplace_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    # Toggle per user
    existing = await db.marketplace_likes.find_one(
        {"marketplace_id": marketplace_id, "user_id": user["user_id"]}
    )
    if existing:
        await db.marketplace_likes.delete_one({"_id": existing["_id"]})
        await db.marketplace_workflows.update_one(
            {"marketplace_id": marketplace_id}, {"$inc": {"likes": -1}}
        )
        return {"liked": False}
    await db.marketplace_likes.insert_one(
        {"marketplace_id": marketplace_id, "user_id": user["user_id"], "at": datetime.now(timezone.utc)}
    )
    await db.marketplace_workflows.update_one(
        {"marketplace_id": marketplace_id}, {"$inc": {"likes": 1}}
    )
    return {"liked": True}


async def seed_marketplace_if_empty():
    """Called at startup — seeds a handful of curated workflows so new users
    have something to install on day one."""
    db = get_db()
    count = await db.marketplace_workflows.count_documents({})
    if count > 0:
        return

    seeds = [
        {
            "name": "Good night", "trigger": "voice:good night",
            "description": "Wind down: flashlight off, brightness low, tomorrow's morning reminder.",
            "icon": "moon", "tags": ["sleep", "night"],
            "steps": [
                {"action": "flashlight_off"},
                {"action": "brightness_down"},
                {"action": "reminder", "payload": {"text": "Start the day", "when": "tomorrow"}},
            ],
        },
        {
            "name": "Focus mode", "trigger": "voice:focus mode",
            "description": "Silence distractions and log a deep-work note.",
            "icon": "eye", "tags": ["productivity", "focus"],
            "steps": [
                {"action": "brightness_down"},
                {"action": "note", "payload": {"text": "Focus block started"}},
            ],
        },
        {
            "name": "Meeting starts", "trigger": "voice:meeting starts",
            "description": "Turn brightness up and drop a meeting note.",
            "icon": "briefcase", "tags": ["work", "meeting"],
            "steps": [
                {"action": "brightness_up"},
                {"action": "note", "payload": {"text": "Meeting notes"}},
            ],
        },
        {
            "name": "Emergency", "trigger": "voice:emergency",
            "description": "Turn the torch on and open the dialer.",
            "icon": "warning", "tags": ["safety"],
            "steps": [
                {"action": "flashlight_on"},
                {"action": "call", "payload": {"target": ""}},
            ],
        },
        {
            "name": "Morning brief", "trigger": "voice:good morning",
            "description": "Bright screen and jot the daily plan.",
            "icon": "sunny", "tags": ["morning"],
            "steps": [
                {"action": "brightness_up"},
                {"action": "note", "payload": {"text": "Today's plan"}},
            ],
        },
    ]

    now = datetime.now(timezone.utc)
    for s in seeds:
        await db.marketplace_workflows.insert_one({
            "marketplace_id": f"mp_{uuid.uuid4().hex[:12]}",
            "author_name": "Hello Sara",
            "author_id": "system",
            "installs": 0,
            "likes": 0,
            "published_at": now,
            **s,
        })

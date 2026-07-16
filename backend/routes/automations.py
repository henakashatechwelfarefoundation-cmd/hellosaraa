"""Automation workflows (Phase 6) + Cloud backup (Phase 5)."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.database import get_db
from core.deps import get_current_user

router = APIRouter(tags=["automations"])


# ---------- Automations ----------

class WorkflowStep(BaseModel):
    action: str
    payload: dict = Field(default_factory=dict)


class Workflow(BaseModel):
    workflow_id: str
    user_id: str
    name: str
    trigger: str  # "manual" | "voice:<phrase>" | "time:<cron-ish>"
    steps: list[WorkflowStep]
    enabled: bool = True
    created_at: datetime
    updated_at: datetime
    run_count: int = 0
    last_run_at: datetime | None = None


class WorkflowCreate(BaseModel):
    name: str
    trigger: str = "manual"
    steps: list[WorkflowStep]
    enabled: bool = True


class WorkflowUpdate(BaseModel):
    name: str | None = None
    trigger: str | None = None
    steps: list[WorkflowStep] | None = None
    enabled: bool | None = None


@router.get("/automations", response_model=list[Workflow])
async def list_workflows(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = await db.workflows.find({"user_id": user["user_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(200)
    return [Workflow(**d) for d in docs]


@router.post("/automations", response_model=Workflow, status_code=status.HTTP_201_CREATED)
async def create_workflow(body: WorkflowCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = {
        "workflow_id": f"wf_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": body.name,
        "trigger": body.trigger,
        "steps": [s.model_dump() for s in body.steps],
        "enabled": body.enabled,
        "created_at": now,
        "updated_at": now,
        "run_count": 0,
        "last_run_at": None,
    }
    await db.workflows.insert_one(dict(doc))
    return Workflow(**doc)


@router.patch("/automations/{workflow_id}", response_model=Workflow)
async def update_workflow(workflow_id: str, body: WorkflowUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    updates: dict = {}
    for k, v in body.model_dump(exclude_none=True).items():
        if k == "steps" and v is not None:
            updates[k] = [s if isinstance(s, dict) else s.model_dump() for s in v]
        else:
            updates[k] = v
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.workflows.update_one({"workflow_id": workflow_id, "user_id": user["user_id"]}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Workflow not found")
    fresh = await db.workflows.find_one({"workflow_id": workflow_id}, {"_id": 0})
    return Workflow(**fresh)


@router.post("/automations/{workflow_id}/run", response_model=Workflow)
async def run_workflow(workflow_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc)
    result = await db.workflows.find_one_and_update(
        {"workflow_id": workflow_id, "user_id": user["user_id"]},
        {"$inc": {"run_count": 1}, "$set": {"last_run_at": now, "updated_at": now}},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return Workflow(**result)


@router.delete("/automations/{workflow_id}")
async def delete_workflow(workflow_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    r = await db.workflows.delete_one({"workflow_id": workflow_id, "user_id": user["user_id"]})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"success": True}


# ---------- Adaptive learning ----------

class UsageEvent(BaseModel):
    kind: str  # "intent" | "screen" | "command"
    key: str


@router.post("/usage")
async def record_usage(body: UsageEvent, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc)
    await db.usage_stats.update_one(
        {"user_id": user["user_id"], "kind": body.kind, "key": body.key},
        {"$inc": {"count": 1}, "$set": {"last_used": now}, "$setOnInsert": {"first_used": now}},
        upsert=True,
    )
    return {"ok": True}


@router.get("/usage/top")
async def top_usage(user: dict = Depends(get_current_user), kind: str | None = None, limit: int = 5):
    db = get_db()
    q: dict = {"user_id": user["user_id"]}
    if kind:
        q["kind"] = kind
    docs = await db.usage_stats.find(q, {"_id": 0, "user_id": 0}).sort("count", -1).to_list(limit)
    return docs


# ---------- Cloud backup ----------

@router.get("/backup")
async def export_backup(user: dict = Depends(get_current_user)):
    """Return a JSON snapshot of every user-owned collection."""
    db = get_db()
    uid = user["user_id"]

    async def dump(coll: str) -> list[dict]:
        docs = await db[coll].find({"user_id": uid}, {"_id": 0}).to_list(10000)
        return docs

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user_id": uid,
        "profile": await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0}),
        "settings": await db.settings.find_one({"user_id": uid}, {"_id": 0}),
        "memories": await dump("memories"),
        "notes": await dump("notes"),
        "reminders": await dump("reminders"),
        "history": await dump("history"),
        "workflows": await dump("workflows"),
        "device_commands": await dump("device_commands"),
        "comm_intents": await dump("comm_intents"),
    }

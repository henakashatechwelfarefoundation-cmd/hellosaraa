"""Device Control & Communication routes — Phase 4 foundation.

These endpoints log intents (calls, SMS, device commands) so the app has a
consistent audit trail. The actual native execution is done client-side by
Expo modules on device (or later, a native Android module). In Expo Go many
of these hardware actions cannot be executed; the endpoints still work as
an intent log.
"""
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.database import get_db
from core.deps import get_current_user

router = APIRouter(prefix="/device", tags=["device"])


DeviceAction = Literal[
    "flashlight_on", "flashlight_off",
    "volume_up", "volume_down", "volume_mute",
    "brightness_up", "brightness_down",
    "wifi_toggle", "bluetooth_toggle",
    "airplane_toggle", "dnd_toggle",
    "alarm_set", "timer_set",
    "screenshot", "lock_screen",
    "open_app", "battery_status",
]

CommAction = Literal["call", "sms", "whatsapp", "email"]


class DeviceCommand(BaseModel):
    command_id: str
    user_id: str
    action: DeviceAction
    payload: dict = {}
    status: Literal["queued", "executed", "failed", "unsupported"]
    created_at: datetime


class DeviceCommandCreate(BaseModel):
    action: DeviceAction
    payload: dict = Field(default_factory=dict)
    status: Literal["queued", "executed", "failed", "unsupported"] = "queued"


class CommIntent(BaseModel):
    intent_id: str
    user_id: str
    action: CommAction
    contact_name: str | None = None
    contact_value: str  # phone/email
    message: str | None = None
    status: Literal["queued", "confirmed", "sent", "failed", "cancelled"]
    created_at: datetime


class CommIntentCreate(BaseModel):
    action: CommAction
    contact_name: str | None = None
    contact_value: str
    message: str | None = None
    status: Literal["queued", "confirmed", "sent", "failed", "cancelled"] = "queued"


@router.get("/commands", response_model=list[DeviceCommand])
async def list_commands(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = await db.device_commands.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return [DeviceCommand(**d) for d in docs]


@router.post("/commands", response_model=DeviceCommand, status_code=status.HTTP_201_CREATED)
async def create_command(body: DeviceCommandCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = {
        "command_id": f"cmd_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "action": body.action,
        "payload": body.payload,
        "status": body.status,
        "created_at": datetime.now(timezone.utc),
    }
    await db.device_commands.insert_one(dict(doc))
    return DeviceCommand(**doc)


@router.get("/comms", response_model=list[CommIntent])
async def list_comms(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = await db.comm_intents.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return [CommIntent(**d) for d in docs]


@router.post("/comms", response_model=CommIntent, status_code=status.HTTP_201_CREATED)
async def create_comm(body: CommIntentCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = {
        "intent_id": f"comm_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "action": body.action,
        "contact_name": body.contact_name,
        "contact_value": body.contact_value,
        "message": body.message,
        "status": body.status,
        "created_at": datetime.now(timezone.utc),
    }
    await db.comm_intents.insert_one(dict(doc))
    return CommIntent(**doc)


@router.delete("/comms/{intent_id}")
async def delete_comm(intent_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.comm_intents.delete_one({"intent_id": intent_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Intent not found")
    return {"success": True}

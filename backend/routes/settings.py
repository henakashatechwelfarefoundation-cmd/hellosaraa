"""Settings routes."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from core.database import get_db
from core.deps import get_current_user
from models.schemas import SettingsModel, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


def _default_settings(user_id: str) -> dict:
    return {
        "user_id": user_id,
        "theme": "dark",
        "language": "en",
        "voice_wake_word_enabled": False,
        "voice_output_enabled": True,
        "voice_speed": 1.0,
        "voice_gender": "female",
        "haptics_enabled": True,
        "notifications_enabled": True,
        "memory_enabled": True,
        "history_enabled": True,
        "ai_provider": "ollama",
        "ai_provider_base_url": "http://localhost:11434",
        "ai_provider_model": "llama3.2",
        "updated_at": datetime.now(timezone.utc),
    }


@router.get("", response_model=SettingsModel)
async def get_settings(user: dict = Depends(get_current_user)):
    db = get_db()
    s = await db.settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not s:
        s = _default_settings(user["user_id"])
        await db.settings.insert_one(dict(s))
    return SettingsModel(**s)


@router.patch("", response_model=SettingsModel)
async def update_settings(body: SettingsUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.settings.update_one(
        {"user_id": user["user_id"]},
        {"$set": updates, "$setOnInsert": {"user_id": user["user_id"]}},
        upsert=True,
    )
    fresh = await db.settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return SettingsModel(**fresh)

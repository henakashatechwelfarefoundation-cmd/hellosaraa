"""User profile routes."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from core.database import get_db
from core.deps import get_current_user
from models.schemas import ProfileUpdate, UserPublic

router = APIRouter(prefix="/profile", tags=["profile"])


def _public(user: dict) -> UserPublic:
    return UserPublic(
        user_id=user["user_id"],
        email=user["email"],
        name=user.get("name", ""),
        picture=user.get("picture"),
        provider=user.get("provider", "email"),
        language=user.get("language", "en"),
        theme=user.get("theme", "dark"),
        created_at=user["created_at"],
        onboarding_completed=user.get("onboarding_completed", False),
    )


@router.get("", response_model=UserPublic)
async def get_profile(user: dict = Depends(get_current_user)):
    return _public(user)


@router.patch("", response_model=UserPublic)
async def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return _public(fresh)

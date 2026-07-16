"""Authentication routes — email/password (JWT) + Emergent Google (session)."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from core.database import get_db
from core.deps import get_current_user
from core.security import create_jwt, hash_password, verify_password
from models.schemas import (
    AuthResponse,
    GoogleSessionRequest,
    LoginRequest,
    RegisterRequest,
    UserPublic,
)
from services.emergent_auth import fetch_session_data

router = APIRouter(prefix="/auth", tags=["auth"])


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


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest):
    db = get_db()
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": body.name.strip(),
        "picture": None,
        "provider": "email",
        "password_hash": hash_password(body.password),
        "language": "en",
        "theme": "dark",
        "created_at": now,
        "updated_at": now,
        "onboarding_completed": False,
    }
    await db.users.insert_one(user_doc)
    # seed default settings
    await db.settings.insert_one({
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
        "updated_at": now,
    })

    token = create_jwt(user_id)
    user_public = _public(user_doc)
    return AuthResponse(token=token, token_type="jwt", user=user_public)


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    db = get_db()
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_jwt(user["user_id"])
    return AuthResponse(token=token, token_type="jwt", user=_public(user))


@router.post("/google/session", response_model=AuthResponse)
async def google_session(body: GoogleSessionRequest):
    """Exchange Emergent session_token for an app session.

    We upsert the user by email, then persist the session in user_sessions.
    The same session_token is returned to the client to use as Bearer.
    """
    data = await fetch_session_data(body.session_token)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google session",
        )

    db = get_db()
    email = data["email"].lower().strip()
    now = datetime.now(timezone.utc)

    user = await db.users.find_one({"email": email})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email.split("@")[0]),
            "picture": data.get("picture"),
            "provider": "google",
            "language": "en",
            "theme": "dark",
            "created_at": now,
            "updated_at": now,
            "onboarding_completed": False,
        }
        await db.users.insert_one(user)
        await db.settings.insert_one({
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
            "updated_at": now,
        })
    else:
        # update picture / name from Google
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"picture": data.get("picture"), "updated_at": now}},
        )

    # Store / refresh session
    expires_at = now + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": data["session_token"]},
        {"$set": {
            "session_token": data["session_token"],
            "user_id": user["user_id"],
            "expires_at": expires_at,
            "created_at": now,
        }},
        upsert=True,
    )

    return AuthResponse(
        token=data["session_token"],
        token_type="session",
        user=_public(user),
    )


@router.get("/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    return _public(current_user)


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    # If the token was a session, revoke it. JWT logout is client-side.
    db = get_db()
    await db.user_sessions.delete_many({"user_id": current_user["user_id"]})
    return {"success": True}

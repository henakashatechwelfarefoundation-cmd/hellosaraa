"""FastAPI dependencies for authentication."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import Header, HTTPException, status

from .database import get_db
from .security import decode_jwt


def _extract_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Resolve the current user from either a JWT (email/password login)
    or a session_token (Emergent Google login)."""
    token = _extract_token(authorization)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    db = get_db()

    # 1. Try JWT first
    payload = decode_jwt(token)
    if payload and payload.get("sub"):
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if user:
            return user

    # 2. Try session_token (Emergent Google)
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        expires_at = session.get("expires_at")
        if isinstance(expires_at, datetime):
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < datetime.now(timezone.utc):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
        user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
        if user:
            return user

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

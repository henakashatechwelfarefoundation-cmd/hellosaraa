"""Emergent Google session verification service."""
import httpx

from core.config import settings


async def fetch_session_data(session_token: str) -> dict | None:
    """Call Emergent's session-data endpoint and return user info.

    Returns None on any failure (network, non-200, invalid payload).
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                settings.EMERGENT_SESSION_API,
                headers={"X-Session-ID": session_token},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            if not data.get("email"):
                return None
            return data
    except Exception:
        return None

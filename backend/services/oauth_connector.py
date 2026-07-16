"""Generic OAuth2 (authorization-code flow) connector.

Handles: building the "connect" URL, exchanging the callback code for
tokens, storing tokens encrypted in Mongo, refreshing expired access
tokens, and handing back a ready-to-use access token for a given
user + provider. Every provider in oauth_providers.PROVIDERS reuses this
same flow because Google/Microsoft/Dropbox/Box are all standard OAuth2.
"""
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx

from core.config import settings
from core.database import get_db
from core.security import decrypt_token, encrypt_token
from services.oauth_providers import PROVIDERS


class OAuthError(Exception):
    pass


def redirect_uri_for(provider: str) -> str:
    return f"{settings.BACKEND_PUBLIC_URL}/api/integrations/{provider}/callback"


async def create_state(user_id: str, provider: str) -> str:
    """One-time, short-lived random token binding this OAuth round trip to
    a specific logged-in user (protects against CSRF on the callback)."""
    db = get_db()
    state = uuid.uuid4().hex
    await db.oauth_states.insert_one({
        "state": state,
        "user_id": user_id,
        "provider": provider,
        "created_at": datetime.now(timezone.utc),
    })
    return state


async def consume_state(state: str) -> dict | None:
    db = get_db()
    doc = await db.oauth_states.find_one_and_delete({"state": state})
    return doc


def build_authorize_url(provider: str, state: str) -> str:
    cfg = PROVIDERS[provider]
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": redirect_uri_for(provider),
        "response_type": "code",
        "state": state,
        **({"scope": " ".join(cfg["scopes"])} if cfg["scopes"] else {}),
        **cfg["extra_auth_params"],
    }
    return f"{cfg['auth_url']}?{urlencode(params)}"


async def exchange_code(provider: str, code: str) -> dict:
    cfg = PROVIDERS[provider]
    data = {
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri_for(provider),
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(cfg["token_url"], data=data, headers={"Accept": "application/json"})
        if r.status_code >= 400:
            raise OAuthError(f"{provider} token exchange failed: {r.text[:300]}")
        return r.json()


async def refresh_access_token(provider: str, refresh_token: str) -> dict:
    cfg = PROVIDERS[provider]
    data = {
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(cfg["token_url"], data=data, headers={"Accept": "application/json"})
        if r.status_code >= 400:
            raise OAuthError(f"{provider} token refresh failed: {r.text[:300]}")
        return r.json()


async def save_tokens(user_id: str, provider: str, token_payload: dict) -> None:
    db = get_db()
    now = time.time()
    expires_in = token_payload.get("expires_in")
    doc = {
        "user_id": user_id,
        "provider": provider,
        "access_token": encrypt_token(token_payload["access_token"]),
        "expires_at": (now + float(expires_in)) if expires_in else None,
        "connected_at": datetime.now(timezone.utc),
        "scope": token_payload.get("scope", ""),
    }
    # Providers only send refresh_token on the FIRST authorization — keep
    # the previous one if this response doesn't include a new one.
    if token_payload.get("refresh_token"):
        doc["refresh_token"] = encrypt_token(token_payload["refresh_token"])
        await db.integrations.update_one(
            {"user_id": user_id, "provider": provider},
            {"$set": doc},
            upsert=True,
        )
    else:
        await db.integrations.update_one(
            {"user_id": user_id, "provider": provider},
            {"$set": {k: v for k, v in doc.items()}},
            upsert=True,
        )


async def get_valid_access_token(user_id: str, provider: str) -> str | None:
    """Returns a usable access token, refreshing it first if it's expired.
    Returns None if the user hasn't connected this provider."""
    db = get_db()
    record = await db.integrations.find_one({"user_id": user_id, "provider": provider})
    if not record:
        return None

    expires_at = record.get("expires_at")
    if expires_at is None or time.time() < expires_at - 60:
        return decrypt_token(record["access_token"])

    refresh_token_enc = record.get("refresh_token")
    if not refresh_token_enc:
        # No refresh token (provider didn't issue one, or offline access
        # wasn't granted) — access token is stale and can't be renewed.
        return None

    refresh_token = decrypt_token(refresh_token_enc)
    if not refresh_token:
        return None

    try:
        fresh = await refresh_access_token(provider, refresh_token)
    except OAuthError:
        return None

    fresh.setdefault("refresh_token", refresh_token)  # some providers omit it on refresh
    await save_tokens(user_id, provider, fresh)
    return fresh["access_token"]


async def list_connections(user_id: str) -> list[dict]:
    db = get_db()
    docs = await db.integrations.find(
        {"user_id": user_id}, {"_id": 0, "access_token": 0, "refresh_token": 0}
    ).to_list(20)
    return docs


async def disconnect(user_id: str, provider: str) -> bool:
    db = get_db()
    res = await db.integrations.delete_one({"user_id": user_id, "provider": provider})
    return res.deleted_count > 0

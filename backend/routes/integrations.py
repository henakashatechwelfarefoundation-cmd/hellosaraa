"""Third-party integrations — Google, Microsoft, Dropbox, Box.

Real OAuth2 wiring. Nothing works until the person deploying this backend
adds their own developer-app credentials as environment variables (see
backend/.env.example) — Anthropic/this codebase never ships client
secrets. Once GOOGLE_CLIENT_ID/SECRET (etc.) are set, the whole flow is
live: connect -> Google's consent screen -> callback -> encrypted token
stored -> data endpoints below start returning real data.

Flow used by the app:
  1. Frontend calls GET /integrations/{provider}/connect-url (authed) and
     gets back a Google/Microsoft/Dropbox/Box consent-screen URL.
  2. Frontend opens that URL with expo-web-browser's auth session helper.
  3. Provider redirects to /integrations/{provider}/callback (public —
     the browser hits it directly, no bearer token available there). We
     recover *which* user this belongs to via the one-time `state` value
     minted in step 1.
  4. Callback exchanges the code for tokens, stores them encrypted, then
     302-redirects to the app's deep link so the WebBrowser auth session
     resolves and the app can refresh its "connected" state.
"""
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from core.config import settings
from core.deps import get_current_user
from services import oauth_connector as oc
from services.oauth_providers import PROVIDERS, is_configured

router = APIRouter(prefix="/integrations", tags=["integrations"])


class ProviderStatus(BaseModel):
    provider: str
    label: str
    configured: bool  # backend has client_id/secret set (via env vars)
    connected: bool   # this user has completed OAuth for it
    connected_at: datetime | None = None


@router.get("", response_model=list[ProviderStatus])
async def list_integrations(user: dict = Depends(get_current_user)):
    connections = {c["provider"]: c for c in await oc.list_connections(user["user_id"])}
    out = []
    for key, cfg in PROVIDERS.items():
        conn = connections.get(key)
        out.append(ProviderStatus(
            provider=key,
            label=cfg["label"],
            configured=is_configured(key),
            connected=bool(conn),
            connected_at=conn.get("connected_at") if conn else None,
        ))
    return out


@router.get("/{provider}/connect-url")
async def get_connect_url(provider: str, user: dict = Depends(get_current_user)):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
    if not is_configured(provider):
        raise HTTPException(
            status_code=400,
            detail=(
                f"{PROVIDERS[provider]['label']} isn't configured on this server yet. "
                f"Add {provider.upper()}_CLIENT_ID / {provider.upper()}_CLIENT_SECRET to the "
                "backend .env (see .env.example) and restart the backend."
            ),
        )
    state = await oc.create_state(user["user_id"], provider)
    return {"url": oc.build_authorize_url(provider, state)}


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
):
    """Public endpoint — the browser is redirected here by the provider,
    with no Authorization header available. Identity comes from `state`."""
    def deep_link(status: str, detail: str = "") -> RedirectResponse:
        sep = "&" if "?" in settings.APP_REDIRECT_SCHEME else "?"
        suffix = f"{sep}status={status}&provider={provider}"
        if detail:
            suffix += f"&detail={detail[:120]}"
        return RedirectResponse(url=f"{settings.APP_REDIRECT_SCHEME}{suffix}")

    if error:
        return deep_link("error", error)
    if provider not in PROVIDERS or not code or not state:
        return deep_link("error", "invalid_callback")

    state_doc = await oc.consume_state(state)
    if not state_doc or state_doc["provider"] != provider:
        return deep_link("error", "invalid_or_expired_state")

    try:
        token_payload = await oc.exchange_code(provider, code)
        await oc.save_tokens(state_doc["user_id"], provider, token_payload)
    except oc.OAuthError as e:
        return deep_link("error", str(e))

    return deep_link("connected")


@router.delete("/{provider}")
async def disconnect_provider(provider: str, user: dict = Depends(get_current_user)):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
    await oc.disconnect(user["user_id"], provider)
    return {"success": True}


async def _authed_get(user_id: str, provider: str, url: str, **kwargs) -> httpx.Response:
    token = await oc.get_valid_access_token(user_id, provider)
    if not token:
        raise HTTPException(status_code=400, detail=f"{provider} is not connected. Connect it in Settings first.")
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, headers=headers, **kwargs)
    if r.status_code == 401:
        raise HTTPException(status_code=400, detail=f"{provider} session expired. Reconnect it in Settings.")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"{provider} API error: {r.text[:300]}")
    return r


async def _authed_post(user_id: str, provider: str, url: str, **kwargs) -> httpx.Response:
    token = await oc.get_valid_access_token(user_id, provider)
    if not token:
        raise HTTPException(status_code=400, detail=f"{provider} is not connected. Connect it in Settings first.")
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, headers=headers, **kwargs)
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"{provider} API error: {r.text[:300]}")
    return r


# ---------------------------------------------------------------- Google --

@router.get("/google/calendar/events")
async def google_calendar_events(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    r = await _authed_get(
        user["user_id"], "google",
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        params={"timeMin": now, "maxResults": 20, "singleEvents": "true", "orderBy": "startTime"},
    )
    items = r.json().get("items", [])
    return [{
        "id": e.get("id"),
        "title": e.get("summary", "(no title)"),
        "start": (e.get("start") or {}).get("dateTime") or (e.get("start") or {}).get("date"),
        "end": (e.get("end") or {}).get("dateTime") or (e.get("end") or {}).get("date"),
        "link": e.get("htmlLink"),
    } for e in items]


class GoogleEventCreate(BaseModel):
    title: str
    start_iso: str
    end_iso: str
    notes: str | None = None


@router.post("/google/calendar/events")
async def google_calendar_create_event(body: GoogleEventCreate, user: dict = Depends(get_current_user)):
    r = await _authed_post(
        user["user_id"], "google",
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        json={
            "summary": body.title,
            "description": body.notes,
            "start": {"dateTime": body.start_iso},
            "end": {"dateTime": body.end_iso},
        },
    )
    return r.json()


@router.get("/google/gmail/messages")
async def google_gmail_messages(user: dict = Depends(get_current_user)):
    r = await _authed_get(
        user["user_id"], "google",
        "https://gmail.googleapis.com/gmail/v1/users/me/messages",
        params={"maxResults": 15, "q": "in:inbox"},
    )
    ids = [m["id"] for m in r.json().get("messages", [])]
    out = []
    for mid in ids[:15]:
        detail = await _authed_get(
            user["user_id"], "google",
            f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{mid}",
            params={"format": "metadata", "metadataHeaders": ["From", "Subject", "Date"]},
        )
        d = detail.json()
        headers = {h["name"]: h["value"] for h in d.get("payload", {}).get("headers", [])}
        out.append({
            "id": mid,
            "from": headers.get("From", ""),
            "subject": headers.get("Subject", "(no subject)"),
            "date": headers.get("Date", ""),
            "snippet": d.get("snippet", ""),
        })
    return out


class GmailSend(BaseModel):
    to: str
    subject: str
    body: str


@router.post("/google/gmail/send")
async def google_gmail_send(body: GmailSend, user: dict = Depends(get_current_user)):
    import base64
    raw_message = (
        f"To: {body.to}\r\nSubject: {body.subject}\r\n"
        f"Content-Type: text/plain; charset=utf-8\r\n\r\n{body.body}"
    )
    raw = base64.urlsafe_b64encode(raw_message.encode("utf-8")).decode("utf-8")
    r = await _authed_post(
        user["user_id"], "google",
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        json={"raw": raw},
    )
    return {"success": True, "id": r.json().get("id")}


@router.get("/google/drive/files")
async def google_drive_files(user: dict = Depends(get_current_user)):
    r = await _authed_get(
        user["user_id"], "google",
        "https://www.googleapis.com/drive/v3/files",
        params={"pageSize": 25, "fields": "files(id,name,mimeType,modifiedTime,webViewLink)", "orderBy": "modifiedTime desc"},
    )
    return r.json().get("files", [])


@router.get("/google/tasks")
async def google_tasks(user: dict = Depends(get_current_user)):
    lists_r = await _authed_get(user["user_id"], "google", "https://tasks.googleapis.com/tasks/v1/users/@me/lists")
    lists = lists_r.json().get("items", [])
    if not lists:
        return []
    list_id = lists[0]["id"]
    r = await _authed_get(user["user_id"], "google", f"https://tasks.googleapis.com/tasks/v1/lists/{list_id}/tasks")
    return r.json().get("items", [])


class GoogleTaskCreate(BaseModel):
    title: str
    notes: str | None = None


@router.post("/google/tasks")
async def google_task_create(body: GoogleTaskCreate, user: dict = Depends(get_current_user)):
    lists_r = await _authed_get(user["user_id"], "google", "https://tasks.googleapis.com/tasks/v1/users/@me/lists")
    lists = lists_r.json().get("items", [])
    if not lists:
        raise HTTPException(status_code=400, detail="No Google Task list found")
    list_id = lists[0]["id"]
    r = await _authed_post(
        user["user_id"], "google", f"https://tasks.googleapis.com/tasks/v1/lists/{list_id}/tasks",
        json={"title": body.title, "notes": body.notes},
    )
    return r.json()


# ------------------------------------------------------------- Microsoft --
# One API surface (Graph) covers Outlook Mail, Calendar, OneDrive, To Do.

GRAPH = "https://graph.microsoft.com/v1.0"


@router.get("/microsoft/mail/messages")
async def microsoft_mail_messages(user: dict = Depends(get_current_user)):
    r = await _authed_get(
        user["user_id"], "microsoft", f"{GRAPH}/me/messages",
        params={"$top": 15, "$select": "subject,from,receivedDateTime,bodyPreview"},
    )
    items = r.json().get("value", [])
    return [{
        "id": m.get("id"),
        "from": (m.get("from") or {}).get("emailAddress", {}).get("address", ""),
        "subject": m.get("subject", "(no subject)"),
        "date": m.get("receivedDateTime", ""),
        "snippet": m.get("bodyPreview", ""),
    } for m in items]


class OutlookSend(BaseModel):
    to: str
    subject: str
    body: str


@router.post("/microsoft/mail/send")
async def microsoft_mail_send(body: OutlookSend, user: dict = Depends(get_current_user)):
    await _authed_post(
        user["user_id"], "microsoft", f"{GRAPH}/me/sendMail",
        json={
            "message": {
                "subject": body.subject,
                "body": {"contentType": "Text", "content": body.body},
                "toRecipients": [{"emailAddress": {"address": body.to}}],
            }
        },
    )
    return {"success": True}


@router.get("/microsoft/calendar/events")
async def microsoft_calendar_events(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    r = await _authed_get(
        user["user_id"], "microsoft", f"{GRAPH}/me/calendarView",
        params={"startDateTime": now, "endDateTime": now, "$top": 20, "$orderby": "start/dateTime"},
        headers={"Prefer": 'outlook.timezone="UTC"'},
    )
    items = r.json().get("value", [])
    return [{
        "id": e.get("id"),
        "title": e.get("subject", "(no title)"),
        "start": (e.get("start") or {}).get("dateTime"),
        "end": (e.get("end") or {}).get("dateTime"),
        "link": e.get("webLink"),
    } for e in items]


class MicrosoftEventCreate(BaseModel):
    title: str
    start_iso: str
    end_iso: str
    notes: str | None = None


@router.post("/microsoft/calendar/events")
async def microsoft_calendar_create(body: MicrosoftEventCreate, user: dict = Depends(get_current_user)):
    r = await _authed_post(
        user["user_id"], "microsoft", f"{GRAPH}/me/events",
        json={
            "subject": body.title,
            "body": {"contentType": "Text", "content": body.notes or ""},
            "start": {"dateTime": body.start_iso, "timeZone": "UTC"},
            "end": {"dateTime": body.end_iso, "timeZone": "UTC"},
        },
    )
    return r.json()


@router.get("/microsoft/drive/files")
async def microsoft_drive_files(user: dict = Depends(get_current_user)):
    r = await _authed_get(user["user_id"], "microsoft", f"{GRAPH}/me/drive/root/children",
                           params={"$top": 25, "$orderby": "lastModifiedDateTime desc"})
    items = r.json().get("value", [])
    return [{
        "id": f.get("id"), "name": f.get("name"),
        "modified": f.get("lastModifiedDateTime"), "link": f.get("webUrl"),
    } for f in items]


@router.get("/microsoft/todo/tasks")
async def microsoft_todo_tasks(user: dict = Depends(get_current_user)):
    lists_r = await _authed_get(user["user_id"], "microsoft", f"{GRAPH}/me/todo/lists")
    lists = lists_r.json().get("value", [])
    if not lists:
        return []
    list_id = lists[0]["id"]
    r = await _authed_get(user["user_id"], "microsoft", f"{GRAPH}/me/todo/lists/{list_id}/tasks", params={"$top": 25})
    return r.json().get("value", [])


class MicrosoftTaskCreate(BaseModel):
    title: str


@router.post("/microsoft/todo/tasks")
async def microsoft_todo_create(body: MicrosoftTaskCreate, user: dict = Depends(get_current_user)):
    lists_r = await _authed_get(user["user_id"], "microsoft", f"{GRAPH}/me/todo/lists")
    lists = lists_r.json().get("value", [])
    if not lists:
        raise HTTPException(status_code=400, detail="No Microsoft To Do list found")
    list_id = lists[0]["id"]
    r = await _authed_post(user["user_id"], "microsoft", f"{GRAPH}/me/todo/lists/{list_id}/tasks",
                            json={"title": body.title})
    return r.json()


# --------------------------------------------------------------- Dropbox --

@router.get("/dropbox/files")
async def dropbox_files(user: dict = Depends(get_current_user)):
    r = await _authed_post(
        user["user_id"], "dropbox", "https://api.dropboxapi.com/2/files/list_folder",
        json={"path": "", "limit": 25},
        headers={"Content-Type": "application/json"},
    )
    entries = r.json().get("entries", [])
    return [{
        "id": e.get("id"), "name": e.get("name"),
        "type": e.get(".tag"), "modified": e.get("server_modified"),
    } for e in entries]


# ------------------------------------------------------------------- Box --

@router.get("/box/files")
async def box_files(user: dict = Depends(get_current_user)):
    r = await _authed_get(
        user["user_id"], "box", "https://api.box.com/2.0/folders/0/items",
        params={"limit": 25, "fields": "id,name,type,modified_at"},
    )
    return r.json().get("entries", [])

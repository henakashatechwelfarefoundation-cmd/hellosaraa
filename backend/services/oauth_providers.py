"""Static OAuth2 config for every third-party connector we support.

Adding a new provider is just adding an entry here (plus, if it needs API
calls beyond generic file listing, a small block in routes/integrations.py).
No client secrets live here — those come from environment variables via
core.config.settings, so the person deploying this app supplies their own
Google/Microsoft/Dropbox/Box developer app credentials.
"""
from core.config import settings

PROVIDERS: dict[str, dict] = {
    "google": {
        "label": "Google (Gmail, Calendar, Drive, Tasks)",
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "scopes": [
            "openid", "email", "profile",
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/tasks",
        ],
        "extra_auth_params": {"access_type": "offline", "prompt": "consent"},
        "auth_style": "params",  # client_id/secret sent as form/query params
    },
    "microsoft": {
        "label": "Microsoft (Outlook Mail, Calendar, OneDrive, To Do)",
        "client_id": settings.MICROSOFT_CLIENT_ID,
        "client_secret": settings.MICROSOFT_CLIENT_SECRET,
        "auth_url": f"https://login.microsoftonline.com/{settings.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize",
        "token_url": f"https://login.microsoftonline.com/{settings.MICROSOFT_TENANT_ID}/oauth2/v2.0/token",
        "scopes": [
            "offline_access", "User.Read",
            "Mail.Read", "Mail.Send",
            "Calendars.ReadWrite",
            "Files.Read",
            "Tasks.ReadWrite",
        ],
        "extra_auth_params": {},
        "auth_style": "params",
    },
    "dropbox": {
        "label": "Dropbox",
        "client_id": settings.DROPBOX_CLIENT_ID,
        "client_secret": settings.DROPBOX_CLIENT_SECRET,
        "auth_url": "https://www.dropbox.com/oauth2/authorize",
        "token_url": "https://api.dropboxapi.com/oauth2/token",
        "scopes": ["files.metadata.read", "files.content.read"],
        "extra_auth_params": {"token_access_type": "offline"},
        "auth_style": "params",
    },
    "box": {
        "label": "Box",
        "client_id": settings.BOX_CLIENT_ID,
        "client_secret": settings.BOX_CLIENT_SECRET,
        "auth_url": "https://account.box.com/api/oauth2/authorize",
        "token_url": "https://api.box.com/oauth2/token",
        "scopes": [],  # Box scopes are configured in the developer console, not the URL
        "extra_auth_params": {},
        "auth_style": "params",
    },
}


def is_configured(provider: str) -> bool:
    cfg = PROVIDERS.get(provider)
    return bool(cfg and cfg["client_id"] and cfg["client_secret"])

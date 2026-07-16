"""Application configuration loaded from environment variables."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


class Settings:
    MONGO_URL: str = os.environ["MONGO_URL"]
    DB_NAME: str = os.environ["DB_NAME"]
    JWT_SECRET: str = os.environ["JWT_SECRET"]
    JWT_EXPIRES_DAYS: int = int(os.environ.get("JWT_EXPIRES_DAYS", "30"))
    JWT_ALGORITHM: str = "HS256"
    EMERGENT_SESSION_API: str = os.environ.get(
        "EMERGENT_SESSION_API",
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
    )

    # Public base URL of THIS backend (used to build OAuth redirect_uri, e.g.
    # https://api.example.com). Must exactly match what's registered with
    # each provider's developer console.
    BACKEND_PUBLIC_URL: str = os.environ.get("BACKEND_PUBLIC_URL", "http://localhost:8000")
    # Deep link back into the app once an OAuth flow finishes, e.g.
    # frontend://integrations. The provider callback redirects here.
    APP_REDIRECT_SCHEME: str = os.environ.get("APP_REDIRECT_SCHEME", "frontend://integrations")

    # Symmetric key used to encrypt stored OAuth tokens at rest (Fernet key —
    # generate with: python -c "from cryptography.fernet import Fernet;
    # print(Fernet.generate_key().decode())"). Falls back to deriving one
    # from JWT_SECRET if not set, so the app still runs without extra setup,
    # but a dedicated key is recommended in production.
    TOKEN_ENCRYPTION_KEY: str = os.environ.get("TOKEN_ENCRYPTION_KEY", "")

    # ---- Google (Calendar, Gmail, Drive, Tasks) ----
    # Create at https://console.cloud.google.com/apis/credentials
    # Redirect URI to register: {BACKEND_PUBLIC_URL}/api/integrations/google/callback
    GOOGLE_CLIENT_ID: str = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.environ.get("GOOGLE_CLIENT_SECRET", "")

    # ---- Microsoft (Outlook Mail, Calendar, OneDrive, MS To Do via Graph) ----
    # Create at https://portal.azure.com -> App registrations
    # Redirect URI to register: {BACKEND_PUBLIC_URL}/api/integrations/microsoft/callback
    MICROSOFT_CLIENT_ID: str = os.environ.get("MICROSOFT_CLIENT_ID", "")
    MICROSOFT_CLIENT_SECRET: str = os.environ.get("MICROSOFT_CLIENT_SECRET", "")
    MICROSOFT_TENANT_ID: str = os.environ.get("MICROSOFT_TENANT_ID", "common")

    # ---- Dropbox ----
    # Create at https://www.dropbox.com/developers/apps
    # Redirect URI to register: {BACKEND_PUBLIC_URL}/api/integrations/dropbox/callback
    DROPBOX_CLIENT_ID: str = os.environ.get("DROPBOX_CLIENT_ID", "")
    DROPBOX_CLIENT_SECRET: str = os.environ.get("DROPBOX_CLIENT_SECRET", "")

    # ---- Box ----
    # Create at https://app.box.com/developers/console
    # Redirect URI to register: {BACKEND_PUBLIC_URL}/api/integrations/box/callback
    BOX_CLIENT_ID: str = os.environ.get("BOX_CLIENT_ID", "")
    BOX_CLIENT_SECRET: str = os.environ.get("BOX_CLIENT_SECRET", "")


settings = Settings()

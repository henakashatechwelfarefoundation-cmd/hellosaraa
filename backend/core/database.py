"""MongoDB client and index bootstrap."""
import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGO_URL)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    global _db
    if _db is None:
        _db = get_client()[settings.DB_NAME]
    return _db


async def ensure_indexes() -> None:
    """Create all indexes required by the app (idempotent)."""
    db = get_db()
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.settings.create_index("user_id", unique=True)
        await db.memories.create_index([("user_id", 1), ("created_at", -1)])
        await db.memories.create_index([("user_id", 1), ("tags", 1)])
        await db.history.create_index([("user_id", 1), ("created_at", -1)])
        await db.reminders.create_index([("user_id", 1), ("remind_at", 1)])
        await db.tasks.create_index([("user_id", 1), ("completed", 1), ("due_at", 1)])
        await db.integrations.create_index([("user_id", 1), ("provider", 1)], unique=True)
        await db.oauth_states.create_index("state", unique=True)
        await db.oauth_states.create_index("created_at", expireAfterSeconds=600)
        logger.info("MongoDB indexes ensured.")
    except Exception as e:
        # Non-fatal — allow app to start even if index creation races
        logger.warning("Index creation warning: %s", e)


async def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None

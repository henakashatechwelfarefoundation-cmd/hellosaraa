"""Hello Sara — FastAPI backend entry point.

All routes are mounted under /api. Business logic lives in `routes/` and
`services/`. This file wires everything together and manages lifecycle.
"""
import logging

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from core.database import close_client, ensure_indexes
from routes.auth import router as auth_router
from routes.automations import router as automations_router
from routes.briefing import router as briefing_router
from routes.chat import router as chat_router
from routes.device import router as device_router
from routes.history import router as history_router
from routes.marketplace import router as marketplace_router, seed_marketplace_if_empty
from routes.memories import router as memories_router
from routes.meta import router as meta_router
from routes.notes import router as notes_router
from routes.ocr import router as ocr_router
from routes.profile import router as profile_router
from routes.reminders import router as reminders_router
from routes.settings import router as settings_router
from routes.tasks import router as tasks_router
from routes.integrations import router as integrations_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("hello_sara")

app = FastAPI(title="Hello Sara API", version="1.0.0")

api_router = APIRouter(prefix="/api")
api_router.include_router(meta_router)
api_router.include_router(auth_router)
api_router.include_router(profile_router)
api_router.include_router(settings_router)
api_router.include_router(memories_router)
api_router.include_router(history_router)
api_router.include_router(reminders_router)
api_router.include_router(notes_router)
api_router.include_router(chat_router)
api_router.include_router(briefing_router)
api_router.include_router(device_router)
api_router.include_router(automations_router)
api_router.include_router(ocr_router)
api_router.include_router(marketplace_router)
api_router.include_router(tasks_router)
api_router.include_router(integrations_router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    await ensure_indexes()
    await seed_marketplace_if_empty()
    logger.info("Hello Sara backend started.")


@app.on_event("shutdown")
async def _shutdown():
    await close_client()

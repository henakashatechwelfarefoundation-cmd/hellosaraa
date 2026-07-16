"""Health + AI provider metadata routes."""
from datetime import datetime, timezone

from fastapi import APIRouter

from models.schemas import AIProviderInfo
from services.ai_provider import get_providers

router = APIRouter(tags=["meta"])


@router.get("/health")
async def health():
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}


@router.get("/ai/providers", response_model=list[AIProviderInfo])
async def ai_providers():
    """Return the list of supported open-source AI providers.

    The application is model-agnostic; the user selects a provider in Settings.
    """
    return get_providers()

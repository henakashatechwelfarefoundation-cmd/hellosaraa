"""OCR route — Phase 5 finishing touch.

Base64-encoded image in, best-effort text out. We try `pytesseract` if
available on the host; otherwise return a graceful "OCR unavailable" that
the client can surface. No proprietary vision API is called.
"""
import base64
import io
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.deps import get_current_user

router = APIRouter(prefix="/ocr", tags=["ocr"])
logger = logging.getLogger(__name__)


class OcrRequest(BaseModel):
    image_base64: str = Field(min_length=32)


class OcrResponse(BaseModel):
    text: str
    engine: str


@router.post("", response_model=OcrResponse)
async def run_ocr(body: OcrRequest, _user: dict = Depends(get_current_user)):
    # Strip a possible data URL prefix
    raw = body.image_base64
    if raw.startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        image_bytes = base64.b64decode(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image")

    try:
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore
        img = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(img) or ""
        return OcrResponse(text=text.strip(), engine="tesseract")
    except Exception as e:
        logger.info("OCR fallback (tesseract not available): %s", e)
        return OcrResponse(
            text="",
            engine="unavailable",
        )

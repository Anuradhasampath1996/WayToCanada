"""
main.py — WayToCanada OCR Microservice entry point.

Run locally:
    uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import get_settings
from app.processing.ocr_engine import get_ocr_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-warm the EasyOCR model on startup so the first request is fast."""
    get_ocr_engine()
    yield


settings = get_settings()

app = FastAPI(
    title="WayToCanada — Document OCR Service",
    description=(
        "AI-powered identity document scanning. "
        "Accepts a document image and returns structured data "
        "(name, DOB, passport/ID number, etc.)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)

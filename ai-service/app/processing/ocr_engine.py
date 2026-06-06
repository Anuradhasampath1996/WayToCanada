"""
ocr_engine.py — EasyOCR singleton wrapper.

EasyOCR loads a ~100 MB neural network on first use.  We initialise it
once at application startup (via lifespan in main.py) and reuse the same
Reader instance for every request.
"""

from __future__ import annotations

import logging

import numpy as np

import easyocr

from app.config import get_settings

logger = logging.getLogger(__name__)

_reader: easyocr.Reader | None = None


def get_ocr_engine() -> easyocr.Reader:
    """Return the shared EasyOCR Reader, initialising it on first call."""
    global _reader
    if _reader is None:
        settings = get_settings()
        logger.info(
            "Initialising EasyOCR (languages=%s, gpu=%s) …",
            settings.easyocr_languages,
            settings.easyocr_gpu,
        )
        _reader = easyocr.Reader(
            settings.easyocr_languages,
            gpu=settings.easyocr_gpu,
            verbose=False,
        )
        logger.info("EasyOCR ready.")
    return _reader


def extract_text(image: np.ndarray) -> tuple[str, float]:
    """
    Run EasyOCR on a preprocessed (binary) image.

    Returns:
        (full_text, average_confidence)
        full_text       — all detected lines joined by newlines, in reading order.
        avg_confidence  — mean detection confidence in [0, 1].
    """
    reader = get_ocr_engine()

    # detail=1 → returns [(bbox, text, confidence), ...]
    # paragraph=False → keep individual line boxes for better ordering
    results: list[tuple] = reader.readtext(image, detail=1, paragraph=False)

    if not results:
        return "", 0.0

    # Sort top-to-bottom, left-to-right (by the top-left corner of each bbox)
    results.sort(key=lambda r: (r[0][0][1], r[0][0][0]))

    lines: list[str] = []
    confidences: list[float] = []

    for _bbox, text, conf in results:
        text = text.strip()
        if text:
            lines.append(text)
            confidences.append(float(conf))

    full_text = "\n".join(lines)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    return full_text, avg_confidence

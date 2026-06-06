"""
base.py — Abstract base parser with shared date / name helpers.
"""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from datetime import datetime

from app.models import ExtractedData


class BaseParser(ABC):
    @abstractmethod
    def parse(self, text: str) -> ExtractedData:
        """Parse raw OCR text into a structured ExtractedData object."""
        ...

    # ── Date normalization ────────────────────────────────────────────────────

    @staticmethod
    def normalize_date(raw: str) -> str:
        """
        Normalise a raw date string into YYYY-MM-DD.

        Handles:
          - MRZ 6-digit YYMMDD
          - DD/MM/YYYY  DD-MM-YYYY  DD.MM.YYYY
          - MM/DD/YYYY  (US format — lower priority)
          - DD Mon YYYY  (e.g. 15 Jan 1990)
          - YYYY-MM-DD  (already normalized)
        """
        raw = raw.strip().replace("  ", " ")

        # MRZ: YYMMDD
        if re.fullmatch(r"\d{6}", raw):
            yy = int(raw[:2])
            mm = raw[2:4]
            dd = raw[4:6]
            # Use current year + 15 as the cutoff so passport expiry years like
            # 2034 (yy=34) map correctly to 2000s rather than 1900s.
            cutoff = (datetime.now().year + 15) % 100
            year = 2000 + yy if yy <= cutoff else 1900 + yy
            return f"{year}-{mm}-{dd}"

        # Try explicit format strings
        for fmt in (
            "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
            "%Y-%m-%d", "%Y/%m/%d",
            "%d %b %Y", "%d %B %Y",
            "%b %d, %Y", "%B %d, %Y",
            "%m/%d/%Y",
        ):
            try:
                return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue

        return raw  # return as-is if nothing matched

    # ── Name cleaning ─────────────────────────────────────────────────────────

    @staticmethod
    def clean_name(raw: str) -> str:
        """
        Clean OCR noise from a name string.
          - Replace MRZ filler '<' with spaces
          - Strip non-alpha characters (keep hyphens and spaces)
          - Title-case the result
        """
        cleaned = re.sub(r"<+", " ", raw)
        cleaned = re.sub(r"[^A-Za-z\s\-]", "", cleaned)
        return " ".join(cleaned.split()).title()

    # ── Generic date finder ───────────────────────────────────────────────────

    _DATE_PAT = re.compile(
        r"\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}"  # DD/MM/YYYY variants
        r"|\d{4}[\/\-]\d{2}[\/\-]\d{2}"               # YYYY-MM-DD
        r"|\d{2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}"
        r")\b",
        re.IGNORECASE,
    )

"""
passport.py — Parser for ICAO TD3 passports.

Strategy:
  1. Look for MRZ lines (44-char lines of uppercase letters, digits, '<').
     MRZ is the most reliable source — always try first.
  2. Fall back to printed-field regex extraction.
"""

from __future__ import annotations

import re

from app.models import ExtractedData
from .base import BaseParser


class PassportParser(BaseParser):
    """Extract structured data from passport OCR text."""

    # ── MRZ patterns ──────────────────────────────────────────────────────────

    # Line 1 of TD3 MRZ: P<NATSurname<<GivenNames...  (44 chars)
    _MRZ_L1 = re.compile(r"^(P[A-Z<])([A-Z]{3})([A-Z<]{39})$")
    # Line 2 of TD3 MRZ: PassportNum+CheckD+NAT+DOB+CheckD+Sex+Expiry+CheckD+...
    _MRZ_L2 = re.compile(
        r"^([A-Z0-9<]{9})"   # passport number (9 chars)
        r"(\d)"              # check digit
        r"([A-Z]{3})"        # nationality
        r"(\d{6})"           # DOB YYMMDD
        r"(\d)"              # check digit
        r"([MFX<])"          # sex
        r"(\d{6})"           # expiry YYMMDD
        r"(\d)"              # check digit
        r"([A-Z0-9<]{14})"   # optional data
        r"(\d{2})$"          # final check digits
    )

    # ── Printed-field patterns ────────────────────────────────────────────────
    # NOTE: use [ \t]*\n?[ \t]* between label and value so we handle both
    # same-line ("Surname: AHMED") and next-line ("Surname\nAHMED") layouts.
    # Use [A-Z ]{n} (no \s!) in value groups to prevent bleeding across lines.

    # ISO 3166-1 alpha-3 → nationality adjective (used when MRZ gives a 3-char code)
    _ISO_NATIONALITY: dict[str, str] = {
        "AFG": "Afghan",       "ALB": "Albanian",    "ARE": "Emirati",
        "AUS": "Australian",   "BGD": "Bangladeshi",  "BRA": "Brazilian",
        "CAN": "Canadian",     "CHN": "Chinese",      "DEU": "German",
        "EGY": "Egyptian",     "ESP": "Spanish",      "ETH": "Ethiopian",
        "FRA": "French",       "GBR": "British",      "GHA": "Ghanaian",
        "IND": "Indian",       "IRN": "Iranian",      "IRQ": "Iraqi",
        "ITA": "Italian",      "JPN": "Japanese",     "JOR": "Jordanian",
        "KEN": "Kenyan",       "KOR": "Korean",       "LKA": "Sri Lankan",
        "MAR": "Moroccan",     "MEX": "Mexican",      "MMR": "Myanmar",
        "NGA": "Nigerian",     "NPL": "Nepali",       "NZL": "New Zealander",
        "PAK": "Pakistani",    "PHL": "Filipino",     "RUS": "Russian",
        "SAU": "Saudi Arabian", "SDN": "Sudanese",    "SOM": "Somali",
        "SYR": "Syrian",       "TUR": "Turkish",      "TZA": "Tanzanian",
        "UGA": "Ugandan",      "USA": "American",     "VNM": "Vietnamese",
        "YEM": "Yemeni",       "ZAF": "South African", "ZMB": "Zambian",
        "ZWE": "Zimbabwean",
    }

    _PASSPORT_NUM = re.compile(r"\b([A-Z]{1,2}[\s\-]?\d{6,8})\b")

    # _SEP: separator between a label and its value.
    # Handles all four real-world EasyOCR output layouts:
    #   1) Same line, colon:         "Nationality: PAKISTANI"
    #   2) Next line, simple:        "Nationality\nPAKISTANI"
    #   3) Next line, bilingual:     "Nationality / ජාතිකත්වය\nSRI LANKAN"
    #   4) Two-box bilingual:        "Nationality\nජාතිකත්වය\nSRI LANKAN"
    #      (EasyOCR splits label + native script into separate boxes)
    # After consuming the label keyword, _SEP:
    #   - consumes the rest of the label line (up to 80 chars) + its newline, then
    #   - skips any number of lines that start with a non-ASCII character (native script),
    #   - OR matches a colon/hyphen followed by optional spaces (same-line colon format).
    _SEP = r"(?:[^\n]{0,80}\n(?:[^\x00-\x7F][^\n]*\n)*[ \t]*|[:\-][ \t]*)"

    _NATIONALITY  = re.compile(r"NATIONALITY"                                                         + _SEP + r"([A-Z][A-Z ]{1,30})", re.I)
    _SURNAME      = re.compile(r"(?:SURNAME|LAST[ \t]*NAME)"                                          + _SEP + r"([A-Z][A-Z ]{0,30})", re.I)
    _GIVEN_NAME   = re.compile(r"(?:GIVEN[ \t]*NAMES?|FIRST[ \t]*NAME)"                               + _SEP + r"([A-Z][A-Z ]{0,30})", re.I)
    _NAME_HOLDER  = re.compile(r"(?:\bNAME\b(?:[ \t]+OF[ \t]+HOLDER)?|\bHOLDER\b)"                   + _SEP + r"([A-Z][A-Z ]{2,30})", re.I)
    _GENDER       = re.compile(r"(?:SEX|GENDER)"      + r"(?:[^\n]{0,80}\n(?:[^\x00-\x7F][^\n]*\n)*[ \t]*|[:\-]?[ \t]+)" + r"(MALE|FEMALE|M|F)\b", re.I)
    _EXPIRY_DATE  = re.compile(r"(?:DATE[ \t]+OF[ \t]+EXPIRY|DATE[ \t]+OF[ \t]+EXPIRATION|EXPIRY[ \t]*DATE|EXPIRY)" + _SEP + r"([0-9][^\n]{4,11})", re.I)
    _DOB_LABEL    = re.compile(r"(?:DATE[ \t]+OF[ \t]+BIRTH|BIRTH[ \t]*DATE|DOB)"                    + _SEP + r"([0-9][^\n]{4,11})", re.I)
    _ISSUE_DATE   = re.compile(r"(?:DATE[ \t]+OF[ \t]+ISSUE|DATE[ \t]+OF[ \t]+ISSUANCE|ISSUE[ \t]*DATE|ISSUED[ \t]*ON)" + _SEP + r"([0-9][^\n]{4,11})", re.I)
    # Same-line: "Date of Issue 27/05/2021" (no newline before value)
    _ISSUE_SAME_LINE = re.compile(
        r"DATE[ \t]+OF[ \t]+ISSUE[ \t:/\-]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        re.I,
    )
    # LKA-style paired row: Issue + Expiry labels on one line, two dates on the next
    _ISSUE_EXPIRY_ROW = re.compile(
        r"DATE[ \t]+OF[ \t]+ISSUE"
        r"(?:[^\n]*)"
        r"DATE[ \t]+OF[ \t]+EXPIR"
        r"[^\n]*\n"
        r"[^\d]*"
        r"(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})"
        r"\s+"
        r"(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        re.I,
    )

    # Flexible MRZ line-2: handles OCR output where '<' fillers are dropped/spaced.
    # Captures: (passport_num)(nationality)(dob_yymmdd)(sex)(expiry_yymmdd)
    # Non-greedy digit length so check digit is not swallowed into the passport no.
    _MRZ_FLEX_L2 = re.compile(
        r"([A-Z]{1,2}[0-9]{6,8}?)"  # passport number
        r"(?:\s*[0-9<])?"           # optional check digit
        r"\s*"
        r"([A-Z]{3})"               # nationality (3 capitals)
        r"([0-9]{6})"               # DOB YYMMDD
        r"(?:\s*[0-9<])?"           # optional check digit
        r"\s*"
        r"([MFX])"                  # sex
        r"([0-9]{6})",              # expiry YYMMDD
    )

    # ── Public ────────────────────────────────────────────────────────────────

    @staticmethod
    def _map_sex(raw: str) -> str:
        code = (raw or "").upper().replace("<", "")
        if code in ("M", "MALE"):
            return "Male"
        if code in ("F", "FEMALE"):
            return "Female"
        if code in ("X", "U", "UNSPECIFIED"):
            return "Other"
        return ""

    def parse(self, text: str) -> ExtractedData:
        # Strategy 1: full MRZ (strategies 1+2 inside _try_mrz)
        mrz_result = self._try_mrz(text)
        if mrz_result and mrz_result.passportNumber:
            # If MRZ was found but name extraction failed (e.g. OCR dropped '<' chars),
            # fall back to the printed Surname + Given Names labels for fullName.
            if not mrz_result.fullName:
                printed = self._parse_printed(text)
                if printed.fullName:
                    mrz_result.fullName = printed.fullName
            # MRZ gives 3-char ISO code — try to get full nationality name from printed field
            if not mrz_result.nationality or len(mrz_result.nationality.replace(" ", "")) <= 3:
                m_nat = self._NATIONALITY.search(text)
                if m_nat:
                    mrz_result.nationality = m_nat.group(1).strip().title()
            self._supplement_issue_date(text, mrz_result)
            return mrz_result

        # Strategy 2: printed-field extraction
        data = self._parse_printed(text)

        # Strategy 3: supplement with flexible MRZ search for fields
        # the printed parser typically cannot extract (nationality, expiry, gender)
        self._supplement_from_flexible_mrz(text, data)

        # Strategy 4: raw-date fallback — only if still missing after MRZ supplement.
        # Runs AFTER supplement so MRZ-derived expiry takes precedence over guessing
        # from unlabeled dates (e.g. Sri Lanka passports show Issue+Expiry together).
        if not data.dob or not data.expiryDate:
            dates = self._DATE_PAT.findall(text)
            normed = [self.normalize_date(d) for d in dates[:4]]
            if not data.dob and normed:
                data.dob = normed[0]
            if not data.expiryDate:
                # Pick the LAST date in the list as expiry (most likely to be furthest future)
                remaining = [d for d in normed if d != data.dob]
                if remaining:
                    data.expiryDate = remaining[-1]

        self._supplement_issue_date(text, data)
        return data

    # ── Issue-date supplement ───────────────────────────────────────────────────

    @staticmethod
    def _is_valid_iso_date(value: str) -> bool:
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", value))

    def _collect_normalized_dates(self, text: str) -> list[str]:
        seen: list[str] = []
        for raw in self._DATE_PAT.findall(text):
            norm = self.normalize_date(raw)
            if self._is_valid_iso_date(norm) and norm not in seen:
                seen.append(norm)
        return seen

    def _supplement_issue_date(self, text: str, data: ExtractedData) -> None:
        """Fill issueDate from printed labels or by inferring from extra dates on the page."""
        if data.issueDate:
            return

        pair = self._ISSUE_EXPIRY_ROW.search(text)
        if pair:
            issue = self.normalize_date(pair.group(1).strip())
            expiry = self.normalize_date(pair.group(2).strip())
            if self._is_valid_iso_date(issue):
                data.issueDate = issue
            if not data.expiryDate and self._is_valid_iso_date(expiry):
                data.expiryDate = expiry
            if data.issueDate:
                return

        for pattern in (self._ISSUE_DATE, self._ISSUE_SAME_LINE):
            m = pattern.search(text)
            if m:
                norm = self.normalize_date(m.group(1).strip())
                if self._is_valid_iso_date(norm):
                    data.issueDate = norm
                    return

        known = {d for d in (data.dob, data.expiryDate) if d}
        if len(known) < 2:
            return

        candidates = [d for d in self._collect_normalized_dates(text) if d not in known]
        if not candidates:
            return
        if len(candidates) == 1:
            data.issueDate = candidates[0]
            return

        dob, exp = data.dob, data.expiryDate
        between = sorted(d for d in candidates if dob < d < exp)
        if between:
            data.issueDate = between[0]
            return

        after_dob = sorted(d for d in candidates if d > dob and d != exp)
        if after_dob:
            data.issueDate = after_dob[0]

    # ── MRZ extraction ────────────────────────────────────────────────────────

    def _try_mrz(self, text: str) -> ExtractedData | None:
        """Find MRZ lines and extract structured data from them.

        EasyOCR often splits a single 44-char MRZ line into several detection
        boxes (returned as separate "lines").  We therefore try:

        1. Exact 44-char lines after stripping spaces
        2. Reconstruct TD3 patterns from an MRZ character blob
        3. Flex line-2 (passport + nat + DOB + sex + expiry) when fillers are dropped
        """
        # ── Strategy 1: per-line exact match after collapsing spaces ─────────
        mrz_lines: list[str] = []
        for ln in text.splitlines():
            clean = re.sub(r"\s+", "", ln.strip()).upper()
            if re.fullmatch(r"[A-Z0-9<]{44}", clean):
                mrz_lines.append(clean)

        mrz_blob = "".join(
            re.sub(r"\s+", "", ln.strip()).upper()
            for ln in text.splitlines()
            if re.fullmatch(r"[A-Z0-9< ]+", ln.strip(), re.I) and len(ln.strip()) >= 3
        )

        # ── Strategy 2: reconstruct from fragmented boxes ────────────────────
        if len(mrz_lines) < 2:
            l1 = re.search(r"(P<[A-Z]{3}[A-Z<]{39})", mrz_blob)
            l2 = re.search(
                r"([A-Z0-9<]{9}[0-9][A-Z]{3}[0-9]{6}[0-9][MFX<][0-9]{6}[0-9][A-Z0-9<]{14}[0-9]{2})",
                mrz_blob,
            )
            if l1 and l2:
                mrz_lines = [l1.group(1), l2.group(1)]

        data = ExtractedData()

        if len(mrz_lines) >= 2:
            line1, line2 = mrz_lines[0], mrz_lines[1]

            m1 = self._MRZ_L1.match(line1)
            if m1:
                name_field = m1.group(3)
                if "<<" in name_field:
                    surname_raw, *given_parts = name_field.split("<<")
                    given_raw = " ".join(" ".join(given_parts).split("<"))
                    surname = self.clean_name(surname_raw)
                    given = self.clean_name(given_raw)
                    data.fullName = f"{given} {surname}".strip()

            m2 = self._MRZ_L2.match(line2)
            if m2:
                passport_raw = m2.group(1).rstrip("<")
                nationality = m2.group(3).replace("<", "")
                data.passportNumber = passport_raw.upper()
                data.nationality = self._ISO_NATIONALITY.get(nationality, nationality.title())
                data.dob = self.normalize_date(m2.group(4))
                data.expiryDate = self.normalize_date(m2.group(7))
                data.gender = self._map_sex(m2.group(6))

        # ── Strategy 3: flex line-2 when exact TD3 failed / incomplete ────────
        if not data.passportNumber or not data.dob:
            flex = self._MRZ_FLEX_L2.search(mrz_blob) or self._MRZ_FLEX_L2.search(
                re.sub(r"[\n\r]+", " ", text).upper()
            )
            if flex:
                if not data.passportNumber:
                    data.passportNumber = flex.group(1).upper()
                nat = flex.group(2)
                if not data.nationality:
                    data.nationality = self._ISO_NATIONALITY.get(nat, nat.title())
                if not data.dob:
                    data.dob = self.normalize_date(flex.group(3))
                if not data.gender:
                    data.gender = self._map_sex(flex.group(4))
                if not data.expiryDate:
                    data.expiryDate = self.normalize_date(flex.group(5))

        # Name from blob if still missing (P<NATSurname<<Given…)
        if not data.fullName and mrz_blob:
            l1m = re.search(r"P<[A-Z]{3}([A-Z<]{2,39}<<[A-Z<]+)", mrz_blob)
            if l1m:
                name_field = l1m.group(1)
                surname_raw, *given_parts = name_field.split("<<")
                given_raw = " ".join(" ".join(given_parts).split("<"))
                surname = self.clean_name(surname_raw)
                given = self.clean_name(given_raw)
                name = f"{given} {surname}".strip()
                if name:
                    data.fullName = name

        return data if (data.passportNumber or data.fullName or data.dob) else None

    # ── Flexible MRZ supplement ──────────────────────────────────────────────

    def _supplement_from_flexible_mrz(self, text: str, data: ExtractedData) -> None:
        """Fill empty fields using a flexible MRZ line-2 search.

        EasyOCR often drops the '<' filler characters, producing output like:
        "N2345678 0PAK960515 1M261224" instead of the full 44-char MRZ line.
        The _MRZ_FLEX_L2 pattern finds the key fields without requiring fillers.
        We only WRITE to fields that are still empty so we don't overwrite
        correctly-extracted values from the printed-field parser.
        """
        if data.nationality and data.expiryDate and data.gender and data.dob:
            return  # already complete

        # Flatten to a single line (uppercase) so the pattern can span OCR boxes
        flat = re.sub(r"[\n\r]+", " ", text).upper()
        m = self._MRZ_FLEX_L2.search(flat)
        if not m:
            return

        nat, dob_raw, sex_raw, expiry_raw = m.group(2), m.group(3), m.group(4), m.group(5)

        if not data.nationality:
            data.nationality = self._ISO_NATIONALITY.get(nat, nat.title())
        if not data.dob:
            data.dob = self.normalize_date(dob_raw)
        if not data.gender:
            data.gender = self._map_sex(sex_raw)
        if not data.expiryDate:
            data.expiryDate = self.normalize_date(expiry_raw)

        # Also try to extract full name from MRZ line 1 if still missing
        if not data.fullName:
            flat_nospace = re.sub(r"\s+", "", flat)
            # Require 'P<' to avoid matching 'PASSPORT' or other P-words in the page text.
            l1m = re.search(r"P<[A-Z]{3}([A-Z<]{10,39}<<)", flat_nospace)
            if l1m:
                name_field = l1m.group(1)
                if "<<" in name_field:
                    surname_raw, *given_parts = name_field.split("<<")
                    given_raw = " ".join(" ".join(given_parts).split("<"))
                    surname = self.clean_name(surname_raw)
                    given = self.clean_name(given_raw)
                    name = f"{given} {surname}".strip()
                    if name:
                        data.fullName = name

    # ── Printed-field extraction ──────────────────────────────────────────────

    def _parse_printed(self, text: str) -> ExtractedData:
        data = ExtractedData()

        # Passport number
        m = self._PASSPORT_NUM.search(text)
        if m:
            data.passportNumber = re.sub(r"[\s\-]", "", m.group(1)).upper()

        # Nationality
        m = self._NATIONALITY.search(text)
        if m:
            data.nationality = m.group(1).strip().title()

        # Full name: try "Name of Holder" label first, then SURNAME + GIVEN NAMES
        mh = self._NAME_HOLDER.search(text)
        if mh:
            data.fullName = self.clean_name(mh.group(1))
        else:
            surname = given = ""
            ms = self._SURNAME.search(text)
            if ms:
                surname = self.clean_name(ms.group(1))
            mg = self._GIVEN_NAME.search(text)
            if mg:
                given = self.clean_name(mg.group(1))
            if surname or given:
                data.fullName = f"{given} {surname}".strip()

        # Gender — look for "Sex: M" or "Gender: MALE" label
        mg2 = self._GENDER.search(text)
        if mg2:
            raw_g = mg2.group(1).upper()
            data.gender = self._map_sex(raw_g)

        # Dates — try labeled patterns first
        md = self._DOB_LABEL.search(text)
        if md:
            data.dob = self.normalize_date(md.group(1).strip())

        me = self._EXPIRY_DATE.search(text)
        if me:
            data.expiryDate = self.normalize_date(me.group(1).strip())

        mi = self._ISSUE_DATE.search(text)
        if mi:
            data.issueDate = self.normalize_date(mi.group(1).strip())

        return data

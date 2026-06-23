from typing import Optional
from pydantic import BaseModel


class ExtractedData(BaseModel):
    """Structured data extracted from an identity document."""

    fullName: str = ""
    passportNumber: str = ""  # Passport only
    idNumber: str = ""        # National ID / Driving Licence
    dob: str = ""             # YYYY-MM-DD
    expiryDate: str = ""      # YYYY-MM-DD
    issueDate: str = ""       # YYYY-MM-DD  (back side: Date of Issue)
    nationality: str = ""
    gender: str = ""
    address: str = ""         # Back side address
    birthPlace: str = ""      # Back side: Birth Place


class ScanResponse(BaseModel):
    """Response envelope returned by /scan-document."""

    status: str            # "success" | "partial_success"
    document_type: str     # "passport" | "national_id" | "driving_license" | "unknown"
    extracted_data: ExtractedData
    confidence_score: float = 0.0
    raw_text: Optional[str] = None   # Debug only; omitted in production
    message: Optional[str] = None


class ExtractTextResponse(BaseModel):
    """Response envelope returned by /extract-text."""

    status: str
    text: str = ""
    page_count: Optional[int] = None
    extraction_method: str = "unknown"
    confidence_score: Optional[float] = None
    message: Optional[str] = None

"""
image_processor.py — OpenCV preprocessing pipeline for document OCR.

Pipeline:
  1. Decode bytes → BGR array
  2. Upscale if image is too small (phone photos, thumbnails)
  3. Convert to grayscale
  4. Light Gaussian blur (fast noise reduction without blurring text)
  5. CLAHE  (adaptive contrast enhancement for non-uniform lighting)
  6. Unsharp-mask sharpening (crisp text edges)
  7. Deskew (straighten tilted documents)

NOTE: We deliberately skip hard binarization (Otsu / adaptive threshold).
EasyOCR's neural network reads enhanced grayscale natively and performs
better than images that have been mis-thresholded (e.g. golden Sri Lanka
NIC, holographic UAE ID, laminated cards with glare).
"""

import cv2
import numpy as np

# If the image is narrower than this we upscale before OCR.
# EasyOCR accuracy drops sharply below ~1000 px; 1400 px is comfortable.
_MIN_WIDTH = 1400
# Cap width so 12 MP phone photos do not make CPU OCR exceed HTTP timeouts.
_MAX_WIDTH = 2000


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Preprocess a document image for EasyOCR.

    Args:
        image_bytes: Raw bytes of a JPEG / PNG / WEBP image.

    Returns:
        Enhanced grayscale numpy array (uint8, single channel).

    Raises:
        ValueError: If the bytes cannot be decoded as an image.
    """
    # ── Decode ────────────────────────────────────────────────────────────────
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image — ensure it is a valid JPEG, PNG or WEBP file.")

    # ── 1. Normalize dimensions for OCR speed + accuracy ─────────────────────
    h, w = img.shape[:2]
    if w > _MAX_WIDTH:
        scale = _MAX_WIDTH / w
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]
    if w < _MIN_WIDTH:
        scale = _MIN_WIDTH / w
        new_w, new_h = int(w * scale), int(h * scale)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

    # ── 2. Grayscale ──────────────────────────────────────────────────────────
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # ── 3. Light Gaussian blur — reduces sensor/compression noise fast ────────
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)

    # ── 4. CLAHE — adaptive contrast; handles glare, shadows, colored BG ─────
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(blurred)

    # ── 5. Unsharp-mask sharpening — makes text edges crisper ─────────────────
    sharp_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
    sharpened = cv2.filter2D(enhanced, -1, sharp_kernel)

    # ── 6. Deskew ─────────────────────────────────────────────────────────────
    return _deskew(sharpened)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _deskew(gray: np.ndarray) -> np.ndarray:
    """
    Detect and correct document skew using the Hough Line Transform.

    Skew correction is only applied when the measured angle is between
    0.5° and 45° to avoid false corrections on non-document images.
    """
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)

    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=80,
        minLineLength=100,
        maxLineGap=10,
    )

    if lines is None or len(lines) == 0:
        return gray

    # Collect angles of detected line segments
    angles: list[float] = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        if x2 != x1:  # avoid division by zero
            angle = float(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
            if -45.0 < angle < 45.0:
                angles.append(angle)

    if not angles:
        return gray

    median_angle = float(np.median(angles))

    # Skip tiny tilts — they're usually noise, not skew
    if abs(median_angle) < 0.5:
        return gray

    h, w = gray.shape
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    rotated = cv2.warpAffine(
        gray,
        M,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return rotated

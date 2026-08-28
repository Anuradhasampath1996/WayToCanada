from pathlib import Path
import numpy as np
from PIL import Image

public = Path(r"F:\WayToCanada\WayToCanada\frontend\Consultant Dashbord\public")
files = [
    "canada-welcome-banner.png",
    "kpi-clients.png",
    "kpi-cases.png",
    "kpi-documents.png",
    "kpi-submit.png",
]

THRESHOLD = 228
SOFT = 32

for name in files:
    path = public / name
    if not path.exists():
        print(f"MISSING {name}")
        continue

    im = Image.open(path).convert("RGBA")
    arr = np.asarray(im).astype("float32")
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = np.where(mx == 0, 0, (mx - mn) / np.maximum(mx, 1))

    wipe = (lum >= THRESHOLD) & (sat <= 0.20)
    soft_wipe = (lum >= (THRESHOLD - SOFT)) & (sat <= 0.32)
    alpha = a.copy()
    alpha[wipe] = 0
    band = soft_wipe & ~wipe
    if band.any():
        t = (lum[band] - (THRESHOLD - SOFT)) / SOFT
        t = np.clip(t, 0, 1)
        sat_f = 1.0 - np.clip(sat[band] / 0.32, 0, 1)
        fade = 1 - t * (0.5 + 0.5 * sat_f)
        alpha[band] = alpha[band] * fade

    out = arr.copy()
    out[:, :, 3] = alpha
    out_im = Image.fromarray(out.astype("uint8"), "RGBA")

    bak = public / f"{name}.bak"
    if not bak.exists():
        bak.write_bytes(path.read_bytes())

    out_im.save(path, optimize=True)
    print(f"OK {name} -> {path.stat().st_size} bytes")

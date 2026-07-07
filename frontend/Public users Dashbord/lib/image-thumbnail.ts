"use client";

import { getDpr, PREVIEW_HEIGHT, PREVIEW_WIDTH, previewPixelSize } from "@/lib/preview-constants";

/** Render an image blob to a sharp data URL (object-cover + object-top). */
export async function renderImageThumbnail(
  blob: Blob,
  maxWidth = PREVIEW_WIDTH,
  maxHeight = PREVIEW_HEIGHT,
): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const dpr = getDpr();
    const { width: pixelW, height: pixelH } = previewPixelSize(dpr);
    const coverScale = Math.max(maxWidth / bitmap.width, maxHeight / bitmap.height) * dpr;
    const drawW = bitmap.width * coverScale;
    const drawH = bitmap.height * coverScale;
    const offsetX = (pixelW - drawW) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = pixelW;
    canvas.height = pixelH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pixelW, pixelH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, offsetX, 0, drawW, drawH);
    bitmap.close();

    return canvas.toDataURL("image/jpeg", 0.95);
  } catch {
    return null;
  }
}

"use client";

import { getDpr, PREVIEW_HEIGHT, PREVIEW_WIDTH, previewPixelSize } from "@/lib/preview-constants";

let workerConfigured = false;

async function getPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  if (!workerConfigured && typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }
  return pdfjsLib;
}

/** Render page 1 to a PNG data URL, cropped like CSS object-cover + object-top. */
export async function renderPdfThumbnail(
  bytes: Uint8Array,
  maxWidth = PREVIEW_WIDTH,
  maxHeight = PREVIEW_HEIGHT,
): Promise<string | null> {
  try {
    const pdfjsLib = await getPdfJs();
    const loadingTask = pdfjsLib.getDocument({
      data: bytes,
      enableXfa: true,
      cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
    });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });

    const dpr = getDpr();
    const { width: pixelW, height: pixelH } = previewPixelSize(dpr);
    const coverScale = Math.max(maxWidth / baseViewport.width, maxHeight / baseViewport.height);
    const viewport = page.getViewport({ scale: coverScale * dpr });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;

    canvas.width = pixelW;
    canvas.height = pixelH;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, pixelW, pixelH);

    const offsetX = (pixelW - viewport.width) / 2;
    context.save();
    context.translate(offsetX, 0);
    await page.render({ canvasContext: context, viewport }).promise;
    context.restore();

    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

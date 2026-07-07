"use client";

import { getDpr, PREVIEW_HEIGHT, PREVIEW_WIDTH, previewPixelSize } from "@/lib/preview-constants";

const PDFJS_BASE = "/pdf-viewer/vendor";

let workerConfigured = false;

async function getPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  if (!workerConfigured && typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/build/pdf.worker.mjs`;
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
      cMapUrl: `${PDFJS_BASE}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDFJS_BASE}/standard_fonts/`,
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

export async function fetchPdfThumbnail(
  streamUrl: string,
  headers: Record<string, string>,
  maxWidth = PREVIEW_WIDTH,
  maxHeight = PREVIEW_HEIGHT,
): Promise<string | null> {
  const res = await fetch(streamUrl, {
    headers: {
      ...headers,
      Accept: "application/pdf, application/octet-stream, */*",
    },
  });
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  if (!buffer.byteLength) return null;
  return renderPdfThumbnail(new Uint8Array(buffer), maxWidth, maxHeight);
}

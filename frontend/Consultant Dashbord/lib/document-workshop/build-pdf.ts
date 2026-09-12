import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export type WorkshopSourceDoc = {
  id: number;
  source_kind?: "case_document" | "package_submission" | "questionnaire";
  document_type: string;
  document_label: string;
  original_filename: string;
  mime_type: string | null;
  file_size: number | null;
  status: string;
  uploaded_at: string | null;
  stream_url: string;
  storage_path?: string | null;
  is_image: boolean;
  is_pdf: boolean;
  case_file_id?: number | null;
};

export type WorkshopPage = {
  id: string;
  sourceKey: string;
  sourceId: number;
  sourceKind: "case_document" | "package_submission" | "questionnaire";
  sourceLabel: string;
  sourcePageIndex: number;
  /** Degrees clockwise: 0 | 90 | 180 | 270 */
  rotation: 0 | 90 | 180 | 270;
  kind: "pdf" | "image";
  /** Raw bytes for the source document (shared across pages from same source). */
  sourceBytes: Uint8Array;
  thumbnailUrl?: string | null;
};

export type BuildWorkshopPdfOptions = {
  pages: WorkshopPage[];
  pageNumbers?: boolean;
  pageWidth?: number;
  pageHeight?: number;
};

export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

/** ~150 DPI on A4 */
const RASTER_SCALE = 2;

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

export async function fetchSourceBytes(
  streamUrl: string,
  getAuthHeaders: () => Record<string, string>,
): Promise<Uint8Array> {
  const res = await fetch(streamUrl, { headers: getAuthHeaders() });
  if (!res.ok) {
    throw new Error(`Failed to load document (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

function pageId(sourceKey: string, pageIndex: number): string {
  return `${sourceKey}-p${pageIndex}-${Math.random().toString(36).slice(2, 8)}`;
}

export function workshopSourceKey(source: Pick<WorkshopSourceDoc, "id" | "source_kind">): string {
  return `${source.source_kind ?? "case_document"}:${source.id}`;
}

/** Expand a PDF or image source into workshop pages (one per PDF page / one for image). */
export async function expandSourceToPages(
  source: WorkshopSourceDoc,
  bytes: Uint8Array,
): Promise<WorkshopPage[]> {
  const label = source.document_label || source.original_filename;
  const sourceKey = workshopSourceKey(source);
  const sourceKind = source.source_kind ?? "case_document";

  if (source.is_image || (source.mime_type ?? "").startsWith("image/")) {
    return [
      {
        id: pageId(sourceKey, 0),
        sourceKey,
        sourceId: source.id,
        sourceKind,
        sourceLabel: label,
        sourcePageIndex: 0,
        rotation: 0,
        kind: "image",
        sourceBytes: bytes,
      },
    ];
  }

  const pdfjsLib = await getPdfJs();
  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(),
    enableXfa: true,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
  });
  const pdf = await loadingTask.promise;
  const pages: WorkshopPage[] = [];
  for (let i = 0; i < pdf.numPages; i++) {
    pages.push({
      id: pageId(sourceKey, i),
      sourceKey,
      sourceId: source.id,
      sourceKind,
      sourceLabel: label,
      sourcePageIndex: i,
      rotation: 0,
      kind: "pdf",
      sourceBytes: bytes,
    });
  }
  return pages;
}

export async function renderWorkshopPageThumbnail(
  page: WorkshopPage,
  maxWidth = 140,
  maxHeight = 180,
): Promise<string | null> {
  try {
    const dataUrl = await renderPageToDataUrl(page, maxWidth, maxHeight);
    return dataUrl;
  } catch {
    return null;
  }
}

async function renderPageToDataUrl(
  page: WorkshopPage,
  maxWidth: number,
  maxHeight: number,
): Promise<string> {
  if (page.kind === "image") {
    return renderImageToDataUrl(page.sourceBytes, page.rotation, maxWidth, maxHeight);
  }

  const pdfjsLib = await getPdfJs();
  const loadingTask = pdfjsLib.getDocument({
    data: page.sourceBytes.slice(),
    enableXfa: true,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
  });
  const pdf = await loadingTask.promise;
  const pdfPage = await pdf.getPage(page.sourcePageIndex + 1);
  const baseViewport = pdfPage.getViewport({ scale: 1, rotation: page.rotation });
  const scale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height);
  const viewport = pdfPage.getViewport({ scale, rotation: page.rotation });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

async function renderImageToDataUrl(
  bytes: Uint8Array,
  rotation: 0 | 90 | 180 | 270,
  maxWidth: number,
  maxHeight: number,
): Promise<string> {
  const blob = new Blob([bytes.slice().buffer], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const rad = (rotation * Math.PI) / 180;
    const swapped = rotation === 90 || rotation === 270;
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    const boxW = swapped ? srcH : srcW;
    const boxH = swapped ? srcW : srcH;
    const scale = Math.min(maxWidth / boxW, maxHeight / boxH, 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(boxW * scale));
    canvas.height = Math.max(1, Math.round(boxH * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, (-srcW * scale) / 2, (-srcH * scale) / 2, srcW * scale, srcH * scale);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = url;
  });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function rotatePage(page: WorkshopPage, delta: 90 | -90 = 90): WorkshopPage {
  const next = (((page.rotation + delta) % 360) + 360) % 360;
  return { ...page, rotation: next as 0 | 90 | 180 | 270, thumbnailUrl: undefined };
}

/**
 * Build a single A4 portrait PDF from arranged workshop pages.
 * Pages are rasterized (with rotation) then fitted onto A4 for reliable layout.
 */
export async function buildWorkshopPdf(options: BuildWorkshopPdfOptions): Promise<Uint8Array> {
  const pageWidth = options.pageWidth ?? A4_WIDTH;
  const pageHeight = options.pageHeight ?? A4_HEIGHT;
  const out = await PDFDocument.create();
  const font = options.pageNumbers ? await out.embedFont(StandardFonts.Helvetica) : null;
  const margin = 18;
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2 - (options.pageNumbers ? 16 : 0);

  for (let i = 0; i < options.pages.length; i++) {
    const page = options.pages[i];
    const outPage = out.addPage([pageWidth, pageHeight]);

    const dataUrl = await renderPageToDataUrl(
      page,
      maxW * RASTER_SCALE,
      maxH * RASTER_SCALE,
    );
    const pngBytes = dataUrlToUint8Array(dataUrl);
    const image = await out.embedPng(pngBytes);
    const scale = Math.min(maxW / image.width, maxH / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    const x = (pageWidth - drawW) / 2;
    const y = margin + (maxH - drawH) / 2;
    outPage.drawImage(image, { x, y, width: drawW, height: drawH });

    if (font && options.pageNumbers) {
      const label = `${i + 1} / ${options.pages.length}`;
      const size = 9;
      const textWidth = font.widthOfTextAtSize(label, size);
      outPage.drawText(label, {
        x: pageWidth - textWidth - 24,
        y: 12,
        size,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
    }
  }

  return out.save();
}

function toBlobPart(bytes: Uint8Array): BlobPart {
  return bytes.slice().buffer;
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([toBlobPart(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function pdfBytesToObjectUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([toBlobPart(bytes)], { type: "application/pdf" }));
}

"use client";

/** Logical preview box size — rendered at 2× DPR for sharp display. */
export const PREVIEW_WIDTH = 640;
export const PREVIEW_HEIGHT = 234;

export function previewPixelSize(dpr = getDpr()) {
  return {
    width: Math.round(PREVIEW_WIDTH * dpr),
    height: Math.round(PREVIEW_HEIGHT * dpr),
    dpr,
  };
}

export function getDpr(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
}

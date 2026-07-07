"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PdfFormViewerPreview({
  bytes,
  label,
  className,
}: {
  bytes: Uint8Array;
  label: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refit = () => {
    iframeRef.current?.contentWindow?.postMessage(
      { target: "wtc-pdf-viewer", type: "refit" },
      "*",
    );
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.source !== "wtc-pdf-viewer") return;
      if (msg.type === "ready") setReady(true);
      if (msg.type === "loaded") setLoaded(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!ready || !bytes.byteLength) return;
    setLoaded(false);
    iframeRef.current?.contentWindow?.postMessage(
      { target: "wtc-pdf-viewer", type: "load-bytes", data: bytes },
      "*",
    );
  }, [ready, bytes]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !loaded) return;
    refit();
    const ro = new ResizeObserver(() => refit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [loaded]);

  return (
    <div
      ref={containerRef}
      className={cn("relative h-44 w-full overflow-hidden bg-white", className)}
    >
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading preview…</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="/pdf-viewer/thumb-preview.html"
        title={label}
        className="pointer-events-none absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}

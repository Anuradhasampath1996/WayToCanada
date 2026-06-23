"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LegislationViewer } from "@/components/legislation/legislation-viewer";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type DocumentDetail = {
  id: number;
  title: string;
  language: string;
  format: string;
  act_code: string | null;
  source_slug: string;
  source_url?: string | null;
  rendered_html?: string | null;
  has_viewer?: boolean;
};

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("wtc_consultant_token") ??
        document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1] ??
        ""
      : "";
  return { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function fetchDocument(id: string): Promise<DocumentDetail> {
  const res = await fetch(`${API}/legislation/documents/${id}`, { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Not found");
  return json.data as DocumentDetail;
}

async function resolveViewerDocument(initial: DocumentDetail): Promise<{
  doc: DocumentDetail;
  viewerHtml: string | null;
  viewerFormat: string;
  viewerDocumentId: number;
}> {
  if (initial.format === "xml" && initial.rendered_html) {
    return {
      doc: initial,
      viewerHtml: initial.rendered_html,
      viewerFormat: "xml",
      viewerDocumentId: initial.id,
    };
  }

  if (initial.format === "html") {
    const listRes = await fetch(`${API}/legislation/documents?language=${initial.language}`, {
      headers: authHeaders(),
    });
    const listJson = await listRes.json();
    const siblings = (listJson.data ?? []) as DocumentDetail[];
    const xmlSibling = siblings.find(
      (d) =>
        d.format === "xml" &&
        d.has_viewer &&
        (d.act_code === initial.act_code || d.source_slug === initial.source_slug),
    );
    if (xmlSibling?.id) {
      const xmlDoc = await fetchDocument(String(xmlSibling.id));
      if (xmlDoc.rendered_html) {
        return {
          doc: initial,
          viewerHtml: xmlDoc.rendered_html,
          viewerFormat: "xml",
          viewerDocumentId: xmlDoc.id,
        };
      }
    }
    if (initial.rendered_html) {
      return {
        doc: initial,
        viewerHtml: initial.rendered_html,
        viewerFormat: "html",
        viewerDocumentId: initial.id,
      };
    }
  }

  return {
    doc: initial,
    viewerHtml: initial.rendered_html ?? null,
    viewerFormat: initial.format,
    viewerDocumentId: initial.id,
  };
}

export default function LegislationDocumentClient({ id }: { id: string }) {
  const [doc, setDoc] = React.useState<DocumentDetail | null>(null);
  const [viewerHtml, setViewerHtml] = React.useState<string | null>(null);
  const [viewerFormat, setViewerFormat] = React.useState("xml");
  const [viewerDocumentId, setViewerDocumentId] = React.useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;

    (async () => {
      try {
        const initial = await fetchDocument(id);
        if (cancelled) return;

        if (initial.format === "pdf") {
          setDoc(initial);
          const dl = await fetch(`${API}/legislation/documents/${id}/download`, { headers: authHeaders() });
          if (!dl.ok) throw new Error("PDF file not available");
          const blob = await dl.blob();
          blobUrl = URL.createObjectURL(blob);
          if (!cancelled) setPdfUrl(blobUrl);
          return;
        }

        const resolved = await resolveViewerDocument(initial);
        if (cancelled) return;
        setDoc(resolved.doc);
        setViewerHtml(resolved.viewerHtml);
        setViewerFormat(resolved.viewerFormat);
        setViewerDocumentId(resolved.viewerDocumentId);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [id]);

  React.useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  if (error) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/legislations"><ArrowLeft className="mr-1 size-4" />Back</Link>
        </Button>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading document…
      </div>
    );
  }

  const showSmartPopupBanner = viewerFormat === "xml" && !!viewerHtml;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/legislations"><ArrowLeft className="mr-1 size-4" />Back to hub</Link>
      </Button>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold leading-snug md:text-2xl">{doc.title}</h1>
          <Badge variant="outline" className="uppercase">{doc.language}</Badge>
          <Badge variant="secondary" className="uppercase">{doc.format}</Badge>
          {doc.act_code && <Badge variant="outline" className="font-mono">{doc.act_code}</Badge>}
        </div>

        {showSmartPopupBanner && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span>
              <strong className="text-primary">Smart popups enabled</strong> — click blue legal references for instant preview.
              When OpenAI is enabled, use the <strong>Maple explains</strong> tab for a consultant-friendly summary.
            </span>
          </div>
        )}

        {doc.format === "html" && viewerFormat === "xml" && (
          <p className="text-xs text-muted-foreground">
            Showing interactive XML view for cross-reference popups.
          </p>
        )}
      </div>

      {viewerHtml && (
        <article className="rounded-xl border bg-background p-5 shadow-sm md:p-8">
          <LegislationViewer
            html={viewerHtml}
            language={doc.language}
            documentId={viewerDocumentId ?? undefined}
            actCode={doc.act_code}
          />
        </article>
      )}

      {doc.format === "pdf" && pdfUrl && (
        <div className="rounded-xl border bg-background p-3 shadow-sm">
          <iframe title={doc.title} src={pdfUrl} className="h-[min(78vh,820px)] w-full rounded-lg" />
        </div>
      )}

      {doc.format === "pdf" && !pdfUrl && (
        <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-muted-foreground">
          <FileText className="size-10 opacity-40" />
          <p className="text-sm">PDF preview loading…</p>
        </div>
      )}

      {!viewerHtml && doc.format !== "pdf" && (
        <div className="rounded-xl border py-16 text-center text-sm text-muted-foreground">
          No viewer content available for this document.
        </div>
      )}

      {doc.source_url && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <a href={doc.source_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 size-3.5" />
              Official source
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { AdminLegislationViewer } from "@/components/legislation/admin-legislation-viewer";
import { UnresolvedReferencesQueue } from "@/components/legislation/unresolved-references-queue";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type DocumentDetail = {
  id: number;
  title: string;
  act_code: string | null;
  source_slug: string;
  language: string;
  format: string;
  category?: string;
  provisions_count: number;
  source_url?: string | null;
  rendered_html?: string | null;
  has_viewer?: boolean;
  ai_analyzed?: boolean;
  last_synced_at?: string | null;
};

type DocListItem = {
  id: number;
  act_code: string | null;
  source_slug: string;
  language: string;
  format: string;
  has_viewer: boolean;
};

type AnalyzeResult = {
  cached: number;
  linked: number;
  expanded?: number;
  unresolved: number;
  already_linked: number;
  prefix_gaps_before?: number;
  prefix_gaps_after?: number;
  openai_used: boolean;
  openai_enabled: boolean;
  references_count: number;
  verify_gated?: boolean;
  stripped_broken?: number;
  unresolved_queued?: number;
  pending_queue?: number;
};

type CacheStats = {
  total: number;
  linked: number;
  unresolved: number;
  pending_queue?: number;
  prefix_gaps?: number;
  by_source: Record<string, number>;
};

async function fetchDocument(docId: string): Promise<DocumentDetail> {
  const res = await fetch(`${API}/admin/legislation/documents/${docId}`, {
    headers: adminAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Document not found");
  return json.data as DocumentDetail;
}

async function resolveViewerDocument(initial: DocumentDetail): Promise<{
  doc: DocumentDetail;
  viewerHtml: string | null;
  viewerFormat: string;
  xmlSourceId: number | null;
}> {
  if (initial.format === "xml" && initial.rendered_html) {
    return {
      doc: initial,
      viewerHtml: initial.rendered_html,
      viewerFormat: "xml",
      xmlSourceId: initial.id,
    };
  }

  if (initial.format === "html") {
    const listRes = await fetch(`${API}/admin/legislation/documents`, { headers: adminAuthHeaders() });
    const listJson = await listRes.json();
    const siblings = (listJson.data ?? []) as DocListItem[];
    const xmlSibling = siblings.find(
      (d) =>
        d.format === "xml" &&
        d.has_viewer &&
        d.language === initial.language &&
        (d.act_code === initial.act_code || d.source_slug === initial.source_slug),
    );
    if (xmlSibling) {
      const xmlDoc = await fetchDocument(String(xmlSibling.id));
      if (xmlDoc.rendered_html) {
        return {
          doc: initial,
          viewerHtml: xmlDoc.rendered_html,
          viewerFormat: "xml",
          xmlSourceId: xmlDoc.id,
        };
      }
    }
    if (initial.rendered_html) {
      return {
        doc: initial,
        viewerHtml: initial.rendered_html,
        viewerFormat: "html",
        xmlSourceId: null,
      };
    }
  }

  return {
    doc: initial,
    viewerHtml: initial.rendered_html ?? null,
    viewerFormat: initial.format,
    xmlSourceId: null,
  };
}

export default function LegislationDocumentClient({ id }: { id: string }) {
  const [doc, setDoc] = React.useState<DocumentDetail | null>(null);
  const [viewerHtml, setViewerHtml] = React.useState<string | null>(null);
  const [viewerFormat, setViewerFormat] = React.useState<string>("xml");
  const [xmlSourceId, setXmlSourceId] = React.useState<number | null>(null);
  const [cacheStats, setCacheStats] = React.useState<CacheStats | null>(null);
  const [analyzeMsg, setAnalyzeMsg] = React.useState<string | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzeProgress, setAnalyzeProgress] = React.useState(0);
  const [analyzeStep, setAnalyzeStep] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [viewerKey, setViewerKey] = React.useState(0);

  const loadCacheStats = React.useCallback(async (docId: number) => {
    try {
      const res = await fetch(`${API}/admin/legislation/documents/${docId}/reference-cache`, {
        headers: adminAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) setCacheStats(json.data?.stats ?? null);
    } catch {
      /* optional */
    }
  }, []);

  const refreshViewer = React.useCallback(async () => {
    const targetId = xmlSourceId ?? (doc?.format === "xml" ? doc.id : null);
    if (!targetId) return;
    const refreshed = await fetchDocument(String(targetId));
    setViewerHtml(refreshed.rendered_html ?? null);
    setViewerKey((k) => k + 1);
    loadCacheStats(targetId);
  }, [xmlSourceId, doc, loadCacheStats]);

  React.useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;

    (async () => {
      try {
        const initial = await fetchDocument(id);
        if (cancelled) return;

        const resolved = await resolveViewerDocument(initial);
        if (cancelled) return;

        setDoc(resolved.doc);
        setViewerHtml(resolved.viewerHtml);
        setViewerFormat(resolved.viewerFormat);
        setXmlSourceId(resolved.xmlSourceId);

        if (resolved.xmlSourceId) {
          loadCacheStats(resolved.xmlSourceId);
        }

        if (initial.format === "pdf") {
          const dl = await fetch(`${API}/admin/legislation/documents/${id}/download`, {
            headers: adminAuthHeaders(),
          });
          if (!dl.ok) throw new Error("PDF file not available");
          const blob = await dl.blob();
          blobUrl = URL.createObjectURL(blob);
          if (!cancelled) setPdfUrl(blobUrl);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [id, loadCacheStats]);

  React.useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const runAnalyzeAndLinkify = async () => {
    const targetId = xmlSourceId ?? (doc?.format === "xml" ? doc.id : null);
    if (!targetId) {
      setAnalyzeMsg("XML document required for AI analysis.");
      return;
    }

    setAnalyzing(true);
    setAnalyzeMsg(null);
    setAnalyzeProgress(0);
    setAnalyzeStep("Starting analysis…");
    try {
      const res = await fetch(`${API}/admin/legislation/documents/${targetId}/analyze-and-linkify`, {
        method: "POST",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify({ use_openai: true, stream: true }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { message?: string }).message ?? "Analysis failed");
      }

      const contentType = res.headers.get("content-type") ?? "";
      let result: AnalyzeResult | null = null;
      let message = "Analysis complete.";

      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const payload = JSON.parse(line.slice(5).trim()) as {
              type?: string;
              percent?: number;
              message?: string;
              step?: string;
              data?: AnalyzeResult;
            };

            if (payload.type === "progress") {
              if (typeof payload.percent === "number") setAnalyzeProgress(payload.percent);
              if (payload.message) setAnalyzeStep(payload.message);
            } else if (payload.type === "complete") {
              result = payload.data ?? null;
              message = payload.message ?? message;
              setAnalyzeProgress(100);
              setAnalyzeStep("Done");
            } else if (payload.type === "error") {
              throw new Error(payload.message ?? "Analysis failed");
            }
          }
        }
      } else {
        const json = await res.json();
        result = json.data as AnalyzeResult;
        message = json.message ?? message;
        setAnalyzeProgress(100);
      }

      const refreshed = await fetchDocument(String(targetId));
      setViewerHtml(refreshed.rendered_html ?? viewerHtml);
      setViewerKey((k) => k + 1);

      if (result) {
        const detail = [
          result.cached ? `${result.cached} cached` : null,
          result.linked ? `${result.linked} new links` : null,
          result.expanded ? `${result.expanded} prefix merged` : null,
          result.stripped_broken ? `${result.stripped_broken} broken stripped` : null,
          result.unresolved_queued ? `${result.unresolved_queued} queued` : null,
          result.prefix_gaps_after === 0 ? "no split refs remaining" : `${result.prefix_gaps_after} split refs left`,
          result.openai_used ? "OpenAI used" : null,
        ].filter(Boolean).join(" · ");
        setAnalyzeMsg(message ?? (detail || "Analysis complete."));
      } else {
        setAnalyzeMsg(message);
      }
      loadCacheStats(targetId);
    } catch (e) {
      setAnalyzeMsg(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
      setAnalyzeStep(null);
    }
  };

  if (error) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admindashboard/legislations-hub">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Legislation Hub
          </Link>
        </Button>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-6 md:p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading document…
      </div>
    );
  }

  const showXmlViewer = viewerHtml && (viewerFormat === "xml" || viewerFormat === "html");
  const canAnalyze = xmlSourceId !== null || doc.format === "xml";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/20">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-4 md:px-6 md:py-5 space-y-3">
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link href="/admindashboard/legislations-hub">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Legislation Hub
            </Link>
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <h1 className="text-xl font-bold leading-snug md:text-2xl">{doc.title}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{doc.act_code ?? doc.source_slug}</Badge>
                <Badge variant="secondary">{doc.language.toUpperCase()}</Badge>
                <Badge variant="secondary">{doc.format.toUpperCase()}</Badge>
                {viewerFormat === "xml" && doc.format === "html" && (
                  <Badge variant="default">Interactive XML view</Badge>
                )}
                {doc.ai_analyzed && <Badge variant="secondary">AI analyzed</Badge>}
                {doc.category && <Badge variant="outline">{doc.category}</Badge>}
                {doc.provisions_count > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {doc.provisions_count.toLocaleString()} provisions
                  </span>
                )}
              </div>
              {showXmlViewer && (
                <p className="text-xs text-muted-foreground max-w-xl">
                  <span className="text-blue-600 dark:text-blue-400">Blue</span> = built-in refs ·{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">Green</span> = AI-cached refs · Click to open popup.
                </p>
              )}
              {cacheStats && (
                <p className="text-xs text-muted-foreground">
                  Reference cache: {cacheStats.total} stored · {cacheStats.linked} links
                  {cacheStats.pending_queue ? ` · ${cacheStats.pending_queue} queued (unresolved)` : ""}
                  {cacheStats.prefix_gaps
                    ? ` · ${cacheStats.prefix_gaps} split refs remaining`
                    : ""}
                  {cacheStats.by_source?.auto_ai ? ` · ${cacheStats.by_source.auto_ai} AI` : ""}
                  {cacheStats.by_source?.auto_xml ? ` · ${cacheStats.by_source.auto_xml} regex` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {canAnalyze && showXmlViewer && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={runAnalyzeAndLinkify}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      {analyzeProgress > 0 ? `${analyzeProgress}%` : "Starting…"}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                      Analyze & Linkify
                    </>
                  )}
                </Button>
              )}
              {doc.source_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={doc.source_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Official source
                  </a>
                </Button>
              )}
            </div>
          </div>
          {(analyzing || analyzeMsg) && (
            <div className="space-y-2">
              {analyzing && (
                <div className="space-y-1.5 rounded-md border bg-muted/50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{analyzeStep ?? "Analyzing…"}</span>
                    <span className="font-medium tabular-nums">{analyzeProgress}%</span>
                  </div>
                  <Progress value={analyzeProgress} className="h-2" />
                </div>
              )}
              {analyzeMsg && !analyzing && (
                <p className="text-xs rounded-md border bg-muted/50 px-3 py-2">{analyzeMsg}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8 space-y-4">
        {showXmlViewer && xmlSourceId && (
          <UnresolvedReferencesQueue
            documentId={xmlSourceId}
            language={doc.language}
            onChanged={refreshViewer}
          />
        )}

        {showXmlViewer && (
          <article className="rounded-xl border bg-background p-5 md:p-8 shadow-sm">
            <AdminLegislationViewer key={viewerKey} html={viewerHtml!} language={doc.language} />
          </article>
        )}

        {doc.format === "pdf" && pdfUrl && (
          <div className="rounded-xl border bg-background p-3 shadow-sm">
            <iframe
              title={doc.title}
              src={pdfUrl}
              className="h-[min(78vh,820px)] w-full rounded-lg"
            />
          </div>
        )}

        {doc.format === "pdf" && !pdfUrl && (
          <div className="rounded-xl border bg-background flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-50" />
            <p className="text-sm">PDF preview loading or unavailable.</p>
          </div>
        )}

        {!showXmlViewer && doc.format !== "pdf" && (
          <div className="rounded-xl border bg-background flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-50" />
            <p className="text-sm">No viewer content. Re-sync this document from Legislation Hub.</p>
          </div>
        )}

        {doc.last_synced_at && (
          <>
            <Separator className="my-6" />
            <p className="text-xs text-muted-foreground text-center">
              Last synced {new Date(doc.last_synced_at).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

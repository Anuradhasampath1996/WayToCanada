"use client";

import * as React from "react";
import { AlertCircle, Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  fetchGovernmentFormResolvedData,
  type GovernmentFormResolvedField,
} from "@/lib/government-forms-api";

async function fetchPdfBlob(streamUrl: string, headers: Record<string, string>): Promise<Blob> {
  const res = await fetch(streamUrl, {
    headers: {
      ...headers,
      Accept: "application/pdf, application/octet-stream, */*",
    },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { message?: string }).message ?? "Failed to load PDF.");
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { message?: string }).message ?? "Failed to load PDF.");
  }
  const blob = await res.blob();
  if (!blob.size) {
    throw new Error("PDF file is empty.");
  }
  return blob;
}

function ResolvedFieldsList({ fields }: { fields: GovernmentFormResolvedField[] }) {
  const filled = fields.filter((f) => f.filled);
  const empty = fields.filter((f) => !f.filled);

  if (fields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-1 py-4">
        No mapped fields found for this form.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
        These are the values mapped into the generated PDF. The{" "}
        <strong>PDF layout</strong> tab shows a browser-readable flattened preview
        (via iText pdfXFA). Official editable downloads stay unflattened.
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="tabular-nums">
          {filled.length} filled
        </Badge>
        {empty.length > 0 && (
          <Badge variant="outline" className="tabular-nums">
            {empty.length} empty
          </Badge>
        )}
      </div>

      <div className="rounded-lg border overflow-hidden">
        <ul className="divide-y max-h-[50vh] overflow-y-auto" role="list">
          {filled.map((field) => (
            <li key={field.key} className="px-3 py-2.5 text-sm bg-background">
              <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
              <p className="mt-0.5 break-words">{field.value}</p>
            </li>
          ))}
          {empty.map((field) => (
            <li key={field.key} className="px-3 py-2.5 text-sm bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
              <p className="mt-0.5 text-muted-foreground italic">Not filled</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function GovernmentFormFilledPreviewDialog({
  open,
  onOpenChange,
  title,
  formCode,
  profileId,
  streamUrl,
  getAuthHeaders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  formCode: string;
  profileId: string;
  streamUrl: string;
  getAuthHeaders: () => Record<string, string>;
}) {
  const blobUrlRef = React.useRef<string | null>(null);
  const getAuthHeadersRef = React.useRef(getAuthHeaders);

  const [tab, setTab] = React.useState<"values" | "pdf">("pdf");
  const [loadingPdf, setLoadingPdf] = React.useState(false);
  const [loadingFields, setLoadingFields] = React.useState(false);
  const [pdfError, setPdfError] = React.useState<string | null>(null);
  const [fieldsError, setFieldsError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<GovernmentFormResolvedField[]>([]);
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);

  getAuthHeadersRef.current = getAuthHeaders;

  const revokeBlobUrl = React.useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
  }, []);

  const officialDownloadUrl = React.useMemo(() => {
    try {
      const u = new URL(streamUrl);
      u.searchParams.delete("flattened");
      u.searchParams.delete("preview");
      u.searchParams.set("download", "1");
      return u.toString();
    } catch {
      return `${streamUrl}${streamUrl.includes("?") ? "&" : "?"}download=1`;
    }
  }, [streamUrl]);

  React.useEffect(() => {
    if (!open) {
      setTab("pdf");
      setPdfError(null);
      setFieldsError(null);
      setFields([]);
      revokeBlobUrl();
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadingFields(true);
      setFieldsError(null);
      try {
        const data = await fetchGovernmentFormResolvedData(profileId, formCode);
        if (!cancelled) setFields(data.fields);
      } catch (e) {
        if (!cancelled) {
          setFieldsError(e instanceof Error ? e.message : "Could not load auto-filled values.");
        }
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, profileId, formCode, revokeBlobUrl]);

  React.useEffect(() => {
    if (!open || tab !== "pdf" || !streamUrl || blobUrl) {
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadingPdf(true);
      setPdfError(null);
      try {
        const blob = await fetchPdfBlob(streamUrl, getAuthHeadersRef.current());
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch (e) {
        if (!cancelled) {
          setPdfError(e instanceof Error ? e.message : "Could not display this PDF.");
        }
      } finally {
        if (!cancelled) setLoadingPdf(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, tab, streamUrl, blobUrl]);

  React.useEffect(() => {
    return () => revokeBlobUrl();
  }, [revokeBlobUrl]);

  const downloadOfficialPdf = () => {
    fetch(officialDownloadUrl, {
      headers: getAuthHeadersRef.current(),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Download failed.");
        return r.blob();
      })
      .then((blob) => {
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = title.replace(/[^\w\s.-]/g, "_") + ".pdf";
        a.click();
        URL.revokeObjectURL(u);
      })
      .catch(() => setPdfError("Download failed."));
  };

  const openInNewTab = () => {
    if (blobUrlRef.current) {
      window.open(blobUrlRef.current, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 sm:max-w-5xl">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="pr-8">{title}</DialogTitle>
          <DialogDescription>
            Browser preview shows auto-filled data without Adobe. With an iText pdfXFA license,
            this is a flattened official layout; otherwise a values sheet is shown.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "values" | "pdf")}
          className="flex flex-col flex-1 min-h-0 gap-0"
        >
          <div className="flex items-center justify-between gap-2 px-5 py-2 border-b bg-muted/30 shrink-0 flex-wrap">
            <TabsList>
              <TabsTrigger value="pdf">PDF preview</TabsTrigger>
              <TabsTrigger value="values">Auto-filled values</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              {blobUrl && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={openInNewTab}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
                </Button>
              )}
              <Button size="sm" className="gap-1.5" onClick={downloadOfficialPdf}>
                <Download className="h-3.5 w-3.5" />
                Download official PDF
              </Button>
            </div>
          </div>

          <TabsContent value="values" className="flex-1 overflow-y-auto px-5 py-4 m-0">
            {loadingFields && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading auto-filled values…
              </div>
            )}
            {fieldsError && !loadingFields && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {fieldsError}
              </div>
            )}
            {!loadingFields && !fieldsError && <ResolvedFieldsList fields={fields} />}
          </TabsContent>

          <TabsContent value="pdf" className="flex-1 m-0 min-h-[55vh] relative bg-neutral-200">
            {loadingPdf && (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/90 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Flattening PDF preview…
              </div>
            )}
            {pdfError && !loadingPdf && (
              <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
                <div className="max-w-md text-center space-y-3 bg-background rounded-xl border p-6 shadow-lg">
                  <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
                  <p className="text-sm font-medium">{pdfError}</p>
                  <Button size="sm" variant="outline" onClick={downloadOfficialPdf}>
                    <Download className="h-4 w-4 mr-1.5" /> Download official PDF
                  </Button>
                </div>
              </div>
            )}
            {!pdfError && (
              <div className="absolute top-0 inset-x-0 z-[5] mx-5 mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
                Browser preview without Adobe. Official IRCC layout flatten needs an iText pdfXFA
                license (<code className="text-[10px]">itextkey.json</code>). Until then, Preview
                shows the auto-filled values sheet. See{" "}
                <button
                  type="button"
                  className="underline font-medium"
                  onClick={() => setTab("values")}
                >
                  Auto-filled values
                </button>
                .
              </div>
            )}
            {blobUrl && !pdfError && (
              <iframe
                title={title}
                src={blobUrl}
                className="absolute inset-0 h-full w-full border-0 bg-white"
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

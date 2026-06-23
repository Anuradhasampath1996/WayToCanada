"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Package, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  downloadCompliancePacketPdf,
  fetchCompliancePacketPreview,
  type CompliancePacketPreview,
} from "@/lib/compliance-packet-download";

export function ClientCompliancePacketExport({ clientId }: { clientId: number }) {
  const [preview, setPreview] = useState<CompliancePacketPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPreview(await fetchCompliancePacketPreview(clientId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load preview.");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      await downloadCompliancePacketPdf(clientId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-xl border border-emerald-200/60 bg-emerald-500/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
            <Shield className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Compliance packet export</p>
            <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
              One PDF with agreement summary, trust ledger, document inventory, and activity audit log — for CICC review.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="h-8 gap-1.5 rounded-lg"
          onClick={() => void handleDownload()}
          disabled={loading || downloading}
        >
          {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          Download packet
        </Button>
      </div>

      {loading && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading packet summary…
        </p>
      )}

      {!loading && preview && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1 text-[11px]">
            <Package className="size-3" />
            {preview.activity_events} activity events
          </Badge>
          <Badge variant="outline" className="text-[11px]">
            {preview.documents_count} documents
          </Badge>
          {preview.agreement?.signed_at ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-500/10 text-[11px] text-emerald-800">
              Agreement signed
            </Badge>
          ) : preview.agreement?.sent_at ? (
            <Badge variant="outline" className="text-[11px]">Agreement sent</Badge>
          ) : null}
          {preview.trust.ledger_entries > 0 && (
            <Badge variant="outline" className="text-[11px]">
              {preview.trust.ledger_entries} trust entries
            </Badge>
          )}
          {preview.activity_truncated && (
            <Badge variant="outline" className="border-amber-200 bg-amber-500/10 text-[11px] text-amber-800">
              Activity log truncated in PDF
            </Badge>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

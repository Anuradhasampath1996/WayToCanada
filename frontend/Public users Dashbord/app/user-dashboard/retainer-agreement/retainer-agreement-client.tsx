"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2, FileText, CheckCircle2, AlertCircle,
  Download, PenLine, Upload, CloudCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ClientJourneyPageChrome } from "@/components/client-workspace-ui";
import { RetainerAgreementDocument } from "@/components/retainer-agreement-document";
import { configFromCaseFile } from "@/lib/retainer-agreement";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ConsultantProfile {
  name: string;
  email: string;
  phone: string | null;
  rcic_number: string | null;
  company_name: string | null;
  company_logo: string | null;
  company_phone: string | null;
  company_website: string | null;
  company_address_line1: string | null;
  company_address_line2: string | null;
  company_city: string | null;
  company_province: string | null;
  company_postal_code: string | null;
  company_country: string | null;
  digital_signature: string | null;
}

interface AgreementData {
  case_file: {
    id: number;
    status: string;
    immigration_pathway: string | null;
    agreement_sent_at: string | null;
    agreement_signed_at: string | null;
    agreement_fee: number | null;
    agreement_notes: string | null;
    agreement_config?: import("@/lib/retainer-agreement").AgreementConfig | null;
    client_signature: string | null;
    signed_document_path: string | null;
  };
  client_name: string | null;
  client_email: string | null;
  consultant_name: string | null;
  consultant_profile: ConsultantProfile | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getCookieToken(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)wtc_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function authHeaders(): Record<string, string> {
  const token =
    (typeof localStorage !== "undefined" ? localStorage.getItem("wtc_token") : null)
    ?? getCookieToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtDate(iso: string | null) {
  if (!iso) return "___________";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

// ─── Signature Pad ──────────────────────────────────────────────────────────────

function SignaturePad({
  onSave,
  isSaving,
}: {
  onSave: (dataUrl: string) => void;
  isSaving: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const lastPos   = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const c    = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const sx   = c.width  / rect.width;
    const sy   = c.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * sx, y: ((e as React.MouseEvent).clientY - rect.top) * sy };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current || !lastPos.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();
    lastPos.current = pos;
    setIsEmpty(false);
  }

  function endDraw() { drawing.current = false; lastPos.current = null; }

  function clearCanvas() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setIsEmpty(true);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full rounded-lg border-2 border-dashed border-input bg-white cursor-crosshair"
          style={{ touchAction: "none" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {isEmpty && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none select-none">
            Draw your signature here
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={isEmpty || isSaving}
          onClick={() => onSave(canvasRef.current!.toDataURL("image/png"))}
          className="gap-1.5"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudCheck className="h-3.5 w-3.5" />}
          {isSaving ? "Signing…" : "Sign Agreement"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={clearCanvas} className="text-muted-foreground">
          Clear
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function RetainerAgreementClient() {
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [token,          setToken]          = useState<string | null>(null);
  const [data,           setData]           = useState<AgreementData | null>(null);
  const [activeTab,      setActiveTab]      = useState<"view" | "sign" | "upload">("view");

  // Sign state
  const [sigName,        setSigName]        = useState("");
  const [signing,        setSigning]        = useState(false);
  const [signError,      setSignError]      = useState<string | null>(null);
  const [signed,         setSigned]         = useState(false);
  const [clientSig,      setClientSig]      = useState<string | null>(null);

  // Upload state
  const [uploadFile,     setUploadFile]     = useState<File | null>(null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadError,    setUploadError]    = useState<string | null>(null);
  const [uploadDone,     setUploadDone]     = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1: get token from dashboard
  useEffect(() => {
    fetch(`${API}/client/dashboard`, { headers: authHeaders() })
      .then(r => r.json())
      .then(json => {
        const tok = json?.case_file?.agreement_token ?? null;
        setToken(tok);
        if (!tok) { setLoading(false); return; }
        // Step 2: fetch agreement
        return fetch(`${API}/case-file/agreement/${tok}`, { headers: { Accept: "application/json" } })
          .then(r => r.json())
          .then(ag => {
            setData(ag);
            const isSigned = !!ag.case_file?.agreement_signed_at;
            setSigned(isSigned);
            setClientSig(ag.case_file?.client_signature ?? null);
            if (ag.client_name) setSigName(ag.client_name);
          });
      })
      .catch(() => setError("Could not load agreement data."))
      .finally(() => setLoading(false));
  }, []);

  async function handleDownloadPdf() {
    if (!token) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(`${API}/case-file/agreement/${token}/pdf`, {
        headers: { Accept: "application/pdf" },
      });
      if (!res.ok) throw new Error("PDF download failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "retainer-agreement.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleSign(dataUrl: string) {
    if (!token) return;
    setSigning(true);
    setSignError(null);
    try {
      const res = await fetch(`${API}/case-file/agreement/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ signature_name: sigName, client_signature: dataUrl }),
      });
      if (!res.ok) {
        const j = await res.json();
        setSignError(j.message ?? "Signing failed.");
        return;
      }
      setClientSig(dataUrl);
      setSigned(true);
      setActiveTab("view");
    } catch {
      setSignError("Network error. Please try again.");
    } finally {
      setSigning(false);
    }
  }

  async function handleUpload() {
    if (!token || !uploadFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("signed_doc", uploadFile);
      const res = await fetch(`${API}/case-file/agreement/${token}/upload-doc`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) { setUploadError(j.message ?? "Upload failed."); return; }
      setUploadDone(true);
      setSigned(true);
      // Refresh data
      fetch(`${API}/case-file/agreement/${token}`, { headers: { Accept: "application/json" } })
        .then(r => r.json())
        .then(ag => { setData(ag); setActiveTab("view"); });
    } catch {
      setUploadError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-destructive font-medium">{error}</p>
      </div>
    );
  }

  // ── No agreement sent yet ──
  if (!token || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold">No Agreement Yet</h1>
        <p className="text-muted-foreground text-sm">
          Your consultant hasn&apos;t sent a retainer agreement yet.
          Once it&apos;s ready, it will appear here for you to review and sign.
        </p>
      </div>
    );
  }

  const isSigned = signed || !!data.case_file.agreement_signed_at;

  return (
    <ClientJourneyPageChrome
      stepId="retainer"
      description={`Review and sign your agreement with ${data.consultant_profile?.company_name ?? data.consultant_name ?? "your consultant"}.`}
      extra={
        <div className="flex items-center gap-2">
          {isSigned ? (
            <Badge className="bg-green-600 text-white gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Signed
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-400 text-amber-700 gap-1.5">
              Awaiting Your Signature
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf} className="gap-1.5">
            {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
      {/* Tabs — only show sign/upload if not yet signed */}
      {!isSigned && (
        <div className="flex gap-1 rounded-xl border bg-muted/40 p-1 w-fit">
          {(["view", "sign", "upload"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeTab === tab
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "view"   && <FileText className="h-3.5 w-3.5" />}
              {tab === "sign"   && <PenLine  className="h-3.5 w-3.5" />}
              {tab === "upload" && <Upload   className="h-3.5 w-3.5" />}
              {tab === "view"   ? "View"
               : tab === "sign" ? "Sign Digitally"
               : "Upload Signed PDF"}
            </button>
          ))}
        </div>
      )}

      {/* ── VIEW tab / signed preview ── */}
      {(activeTab === "view" || isSigned) && (
        <RetainerAgreementDocument
          config={configFromCaseFile(data.case_file)}
          clientName={data.client_name ?? ""}
          clientEmail={data.client_email ?? ""}
          consultantName={data.consultant_name ?? ""}
          consultantProfile={data.consultant_profile}
          clientSignature={clientSig}
          agreementDate={data.case_file.agreement_sent_at}
          clientSignedDate={data.case_file.agreement_signed_at}
        />
      )}

      {/* ── SIGN tab ── */}
      {!isSigned && activeTab === "sign" && (
        <div className="rounded-xl border bg-card p-6 space-y-5 w-full">
          <div>
            <h2 className="font-semibold flex items-center gap-2 mb-1">
              <PenLine className="h-4 w-4 text-primary" /> Sign with Digital Signature
            </h2>
            <p className="text-sm text-muted-foreground">
              Draw your signature in the box below. By signing, you agree to the terms of this retainer agreement.
            </p>
          </div>

          {/* Name field */}
          <div>
            <label className="text-xs font-medium mb-1 block">Your Full Name (as it appears on the agreement)</label>
            <input
              type="text"
              value={sigName}
              onChange={e => setSigName(e.target.value)}
              placeholder="Full legal name"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Signature pad */}
          <div>
            <label className="text-xs font-medium mb-2 block">Your Signature</label>
            <SignaturePad onSave={handleSign} isSaving={signing} />
          </div>

          {signError && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />{signError}
            </p>
          )}

          <p className="text-[11px] text-muted-foreground italic">
            By clicking &quot;Sign Agreement&quot;, you confirm that you have read, understood, and agree to all the terms of this Retainer Agreement.
          </p>
        </div>
      )}

      {/* ── UPLOAD tab ── */}
      {!isSigned && activeTab === "upload" && (
        <div className="rounded-xl border bg-card p-6 space-y-5 w-full">
          <div>
            <h2 className="font-semibold flex items-center gap-2 mb-1">
              <Upload className="h-4 w-4 text-primary" /> Upload Signed Document
            </h2>
            <p className="text-sm text-muted-foreground">
              Download the agreement, print it, sign it by hand, scan it, and upload the signed PDF here.
            </p>
          </div>

          <div className="space-y-3">
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf} className="gap-1.5">
              {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download Agreement to Print
            </Button>

            <div>
              <label className="text-xs font-medium mb-1 block">Upload Signed PDF</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-input file:text-sm file:font-medium file:bg-background hover:file:bg-muted cursor-pointer"
              />
              {uploadFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>

            {uploadError && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />{uploadError}
              </p>
            )}

            {uploadDone && (
              <p className="text-sm text-green-700 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> Document uploaded successfully!
              </p>
            )}

            <Button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
              className="gap-1.5"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Submit Signed Document"}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground italic">
            Only PDF files are accepted. Max size 10 MB. By uploading, you confirm you have signed the agreement.
          </p>
        </div>
      )}

      {/* Signed confirmation banner */}
      {isSigned && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-center gap-3 text-sm text-green-800 w-full">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          <div>
            <p className="font-semibold">Agreement Signed</p>
            <p className="text-xs text-green-700 mt-0.5">
              Signed on {fmtDate(data.case_file.agreement_signed_at)}.
              Your consultant has been notified.
            </p>
          </div>
        </div>
      )}
      </div>
    </ClientJourneyPageChrome>
  );
}

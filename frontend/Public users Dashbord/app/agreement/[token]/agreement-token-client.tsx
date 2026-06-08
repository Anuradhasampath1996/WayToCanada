"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2, FileText, CheckCircle2, AlertCircle,
  Download, PenLine, Upload, CloudCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RetainerAgreementDocument } from "@/components/retainer-agreement-document";
import { configFromCaseFile } from "@/lib/retainer-agreement";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

interface AgreementData {
  case_file: {
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
  consultant_profile: import("@/components/retainer-agreement-document").ConsultantProfileDoc | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return "___________";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function SignaturePad({ onSave, isSaving }: { onSave: (dataUrl: string) => void; isSaving: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function endDraw() { drawing.current = false; }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={500}
        height={120}
        className="w-full rounded-lg border border-dashed border-input bg-white touch-none cursor-crosshair"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={isSaving} className="gap-1.5">
          {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <CloudCheck className="size-3.5" />}
          {isSaving ? "Signing…" : "Sign Agreement"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={clearCanvas}>Clear</Button>
      </div>
    </div>
  );
}

export function AgreementTokenClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AgreementData | null>(null);
  const [activeTab, setActiveTab] = useState<"view" | "sign" | "upload">("view");
  const [sigName, setSigName] = useState("");
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [clientSig, setClientSig] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API}/case-file/agreement/${token}`, { headers: { Accept: "application/json" } })
      .then(async (r) => {
        if (!r.ok) throw new Error("Invalid or expired agreement link.");
        return r.json();
      })
      .then((ag) => {
        setData(ag);
        setSigned(!!ag.case_file?.agreement_signed_at);
        setClientSig(ag.case_file?.client_signature ?? null);
        if (ag.client_name) setSigName(ag.client_name);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load agreement."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDownloadPdf() {
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
    if (!uploadFile) return;
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
      setSigned(true);
      const ag = await fetch(`${API}/case-file/agreement/${token}`).then((r) => r.json());
      setData(ag);
      setActiveTab("view");
    } catch {
      setUploadError("Network error.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <AlertCircle className="mx-auto size-10 text-destructive" />
        <p className="mt-3 font-medium text-destructive">{error ?? "Agreement not found"}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/user-dashboard">Go to your dashboard</Link>
        </Button>
      </div>
    );
  }

  const isSigned = signed || !!data.case_file.agreement_signed_at;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Retainer Agreement</h1>
          <p className="text-sm text-muted-foreground">
            {data.consultant_profile?.company_name ?? data.consultant_name ?? "Your consultant"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSigned ? (
            <Badge className="bg-green-600 text-white">Signed</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-400 text-amber-700">Awaiting signature</Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf} className="gap-1.5">
            {downloadingPdf ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            PDF
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/user-dashboard/retainer-agreement">Open in dashboard</Link>
          </Button>
        </div>
      </div>

      {!isSigned && (
        <div className="flex w-fit gap-1 rounded-xl border bg-muted/40 p-1">
          {(["view", "sign", "upload"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
                activeTab === tab ? "bg-background text-foreground shadow" : "text-muted-foreground",
              )}
            >
              {tab === "view" ? <FileText className="size-3.5" /> : tab === "sign" ? <PenLine className="size-3.5" /> : <Upload className="size-3.5" />}
              {tab === "view" ? "View" : tab === "sign" ? "Sign" : "Upload PDF"}
            </button>
          ))}
        </div>
      )}

      {(activeTab === "view" || isSigned) && data && (
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

      {!isSigned && activeTab === "sign" && (
        <div className="space-y-4 rounded-xl border bg-card p-6">
          <input
            type="text"
            value={sigName}
            onChange={(e) => setSigName(e.target.value)}
            placeholder="Full legal name"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <SignaturePad onSave={handleSign} isSaving={signing} />
          {signError && <p className="text-sm text-destructive">{signError}</p>}
        </div>
      )}

      {!isSigned && activeTab === "upload" && (
        <div className="space-y-4 rounded-xl border bg-card p-6">
          <input ref={fileInputRef} type="file" accept=".pdf" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
          <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : "Submit signed PDF"}
          </Button>
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        </div>
      )}

      {isSigned && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
          <CheckCircle2 className="size-5 shrink-0 text-green-600" />
          <div>
            <p className="font-semibold">Agreement signed</p>
            <p className="text-xs">Signed on {fmtDate(data.case_file.agreement_signed_at)}. Your consultant has been notified.</p>
          </div>
        </div>
      )}
    </div>
  );
}

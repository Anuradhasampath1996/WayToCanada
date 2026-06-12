"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccountPaymentSettings } from "./account-payment-settings";
import { AccountMeetingSettings } from "./account-meeting-settings";
import { AccountNotificationSettings } from "./account-notification-settings";
import {
  User, Mail, Phone, BadgeCheck, Shield,
  CheckCircle2, Building2, MapPin,
  Upload, ImageIcon, Loader2, CloudCheck, Info,
  Lock, PenLine, CreditCard, ExternalLink, Video, Bell,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";
const AUTOSAVE_MS = 1400;

function authHeaders(json = true): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ?? localStorage.getItem("wtc_consultant_token") ?? "";
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Accept: "application/json",
  };
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  id,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border/50 bg-muted/25 px-6 py-4 md:px-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="p-6 md:p-8">{children}</div>
    </section>
  );
}

interface ConsultantProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  cicc_email: string | null;
  rcic_number: string | null;
  is_license_verified: boolean;
  license_verified_at: string | null;
  created_at: string | null;
  company_name: string | null;
  company_logo: string | null;
  company_bio: string | null;
  company_website: string | null;
  company_phone: string | null;
  company_address_line1: string | null;
  company_address_line2: string | null;
  company_city: string | null;
  company_province: string | null;
  company_postal_code: string | null;
  company_country: string | null;
  digital_signature: string | null;
}

interface RcicRegistry {
  full_name: string | null;
  type: string | null;
  status: string | null;
  company: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  languages: string | null;
  entitled_to_practise: boolean;
  profile_url: string | null;
}

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Field({
  label, value, onChange, type = "text", placeholder, readOnly = false, hint,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border px-3 py-2.5 text-sm transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-emerald-500/20",
          readOnly
            ? "bg-muted/50 border-input text-muted-foreground cursor-not-allowed"
            : "bg-background border-input hover:border-border"
        )}
      />
      {hint && <p className="text-xs text-muted-foreground italic">{hint}</p>}
    </div>
  );
}

// â”€â”€â”€ Save status pill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

function SavePill({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === "idle")   return null;
  if (status === "dirty")  return <span className="text-xs text-muted-foreground">Unsaved…</span>;
  if (status === "saving") return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" /> Saving…
    </span>
  );
  if (status === "saved")  return (
    <span className="flex items-center gap-1 text-xs text-emerald-600">
      <CloudCheck className="h-3 w-3" /> Saved
    </span>
  );
  return <span className="text-xs text-destructive">{error ?? "Save failed"}</span>;
}

function SignaturePad({
  onSave, onClear, isSaving,
}: {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
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
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * sx,
      y: ((e as React.MouseEvent).clientY - rect.top)  * sy,
    };
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
    onClear();
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
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
          type="button" size="sm"
          onClick={() => onSave(canvasRef.current!.toDataURL("image/png"))}
          disabled={isEmpty || isSaving}
          className="gap-1.5"
        >
          {isSaving
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <CloudCheck className="h-3.5 w-3.5" />}
          {isSaving ? "Saving..." : "Save Signature"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={clearCanvas} className="text-muted-foreground">
          Clear
        </Button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function AccountClient() {
  const searchParams = useSearchParams();
  const stripeConnectReturn = searchParams.get("stripe_connect") === "return";
  const meetOAuthReturn = searchParams.has("meet_oauth");
  const meetOAuthProvider = searchParams.get("meet_oauth");
  const meetOAuthStatus = searchParams.get("status");
  const meetOAuthMessage = searchParams.get("message");
  const [profile,    setProfile]    = useState<ConsultantProfile | null>(null);
  const [registry,   setRegistry]   = useState<RcicRegistry | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError,  setSaveError]  = useState<string | null>(null);

  // Editable fields
  const [name,      setName]      = useState("");
  const [phone,     setPhone]     = useState("");
  const [ciccEmail, setCiccEmail] = useState("");
  const [posType,   setPosType]   = useState("");

  // Company fields
  const [companyName,   setCompanyName]   = useState("");
  const [companyBio,    setCompanyBio]    = useState("");
  const [companyWeb,    setCompanyWeb]    = useState("");
  const [companyPhone,  setCompanyPhone]  = useState("");
  const [addrLine1,     setAddrLine1]     = useState("");
  const [addrLine2,     setAddrLine2]     = useState("");
  const [city,          setCity]          = useState("");
  const [province,      setProvince]      = useState("");
  const [postalCode,    setPostalCode]    = useState("");
  const [country,       setCountry]       = useState("Canada");

  // Logo
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview,   setLogoPreview]   = useState<string | null>(null);
  const logoInputRef  = useRef<HTMLInputElement>(null);

  // Signature
  const [sigSaved,   setSigSaved]   = useState<string | null>(null);
  const [sigSaving,  setSigSaving]  = useState(false);
  const [sigStatus,  setSigStatus]  = useState<"idle" | "saved" | "error">("idle");
  const [showSigPad, setShowSigPad] = useState(false);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const firstLoad     = useRef(true);

  // â”€â”€ Load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    async function load() {
      try {
        const [pRes, rRes] = await Promise.all([
          fetch(`${API}/consultant/profile`,       { headers: authHeaders() }),
          fetch(`${API}/consultant/rcic-registry`, { headers: authHeaders() }),
        ]);
        const prof: ConsultantProfile = await pRes.json();
        const reg: RcicRegistry | null = rRes.ok ? await rRes.json() : null;

        setProfile(prof);
        setRegistry(reg);

        // Prefer saved profile value; fall back to CICC registry if empty
        const p = (profVal: string | null, regVal: string | null | undefined) =>
          profVal ?? regVal ?? "";

        setName(prof.name ?? "");
        setPhone(prof.phone ?? "");
        setCiccEmail(prof.cicc_email ?? "");
        setPosType(reg?.type ?? "");
        setCompanyName(p(prof.company_name, reg?.company));
        setCompanyBio(prof.company_bio ?? "");
        setCompanyWeb(p(prof.company_website, reg?.website));
        setCompanyPhone(p(prof.company_phone, reg?.phone));
        setAddrLine1(p(prof.company_address_line1, reg?.address_line_1));
        setAddrLine2(p(prof.company_address_line2, reg?.address_line_2));
        setCity(p(prof.company_city, reg?.city));
        setProvince(p(prof.company_province, reg?.province));
        setPostalCode(p(prof.company_postal_code, reg?.postal_code));
        setCountry(p(prof.company_country, reg?.country) || "Canada");
        setLogoPreview(prof.company_logo ?? null);
        setSigSaved(prof.digital_signature ?? null);
      } finally {
        setLoading(false);
        firstLoad.current = false;
      }
    }
    load();
  }, []);

  // â”€â”€ Auto-save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const doSave = useCallback(async (vals: Record<string, string>) => {
    if (!vals.name.trim()) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch(`${API}/consultant/profile`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          name:                   vals.name,
          phone:                  vals.phone || null,
          cicc_email:             vals.ciccEmail || null,
          company_name:           vals.companyName || null,
          company_bio:            vals.companyBio || null,
          company_website:        vals.companyWeb || null,
          company_phone:          vals.companyPhone || null,
          company_address_line1:  vals.addrLine1 || null,
          company_address_line2:  vals.addrLine2 || null,
          company_city:           vals.city || null,
          company_province:       vals.province || null,
          company_postal_code:    vals.postalCode || null,
          company_country:        vals.country || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.errors
          ? (Object.values(json.errors as Record<string, string[]>).flat()[0])
          : json?.message;
        setSaveError(msg ?? "Save failed");
        setSaveStatus("error");
        return;
      }
      setProfile(json as ConsultantProfile);
      try {
        const raw = localStorage.getItem("wtc_consultant_user");
        localStorage.setItem("wtc_consultant_user", JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), name: json.name }));
      } catch {}
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(s => s === "saved" ? "idle" : s), 3000);
    } catch {
      setSaveError("Network error");
      setSaveStatus("error");
    }
  }, []);

  useEffect(() => {
    if (firstLoad.current) return;
    setSaveStatus("dirty");
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      doSave({ name, phone, ciccEmail, companyName, companyBio, companyWeb, companyPhone, addrLine1, addrLine2, city, province, postalCode, country });
    }, AUTOSAVE_MS);
    return () => clearTimeout(autoSaveTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, phone, ciccEmail, companyName, companyBio, companyWeb, companyPhone, addrLine1, addrLine2, city, province, postalCode, country]);

  // â”€â”€ Logo upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch(`${API}/consultant/profile/logo`, { method: "POST", headers: authHeaders(false), body: fd });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.message ?? "Upload failed"); setSaveStatus("error"); return; }
      setLogoPreview(json.company_logo);
      setProfile(prev => prev ? { ...prev, company_logo: json.company_logo } : prev);
    } catch {
      setSaveError("Logo upload failed");
      setSaveStatus("error");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }


  async function handleSaveSignature(dataUrl: string) {
    setSigSaving(true);
    setSigStatus("idle");
    try {
      const res  = await fetch(`${API}/consultant/profile/signature`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ signature: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) { setSigStatus("error"); return; }
      setSigSaved(json.digital_signature);
      setSigStatus("saved");
      setShowSigPad(false);
      setTimeout(() => setSigStatus(s => s === "saved" ? "idle" : s), 3000);
    } catch {
      setSigStatus("error");
    } finally {
      setSigSaving(false);
    }
  }

  async function handleClearSignature() {
    setSigSaving(true);
    try {
      await fetch(`${API}/consultant/profile/signature`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ signature: null }),
      });
      setSigSaved(null);
      setSigStatus("idle");
      setShowSigPad(false);
    } finally {
      setSigSaving(false);
    }
  }
  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (loading) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading your profile…
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center text-destructive text-sm">
        Could not load profile.
      </div>
    );
  }

  const initials     = getInitials(profile.name ?? "C");
  const fromRegistry = registry !== null;

  const officeLine = [city, province, country].filter(Boolean).join(", ");

  return (
    <div className="w-full pb-16 space-y-8">

      {/* Hero — full-width trust header */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800/10 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="relative px-6 py-8 md:px-10 md:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0">
              <Avatar className="h-24 w-24 ring-4 ring-white/10 shadow-xl">
                <AvatarImage src={profile.avatar ?? logoPreview ?? ""} alt={profile.name} />
                <AvatarFallback className="bg-emerald-600/30 text-white font-bold text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300/90">Consultant profile</p>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{name || profile.name}</h1>
                <p className="text-sm text-slate-300 flex items-center gap-2 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {profile.email}
                </p>
                {companyName && (
                  <p className="text-sm text-slate-400 flex items-center gap-2 truncate">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    {companyName}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {profile.is_license_verified ? (
                    <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-400/30 gap-1">
                      <BadgeCheck className="h-3 w-3" /> CICC Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-400/40 text-amber-100 gap-1">
                      <Shield className="h-3 w-3" /> Pending verification
                    </Badge>
                  )}
                  {profile.rcic_number && (
                    <Badge variant="outline" className="font-mono text-xs border-white/20 text-slate-200">
                      {profile.rcic_number}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end shrink-0 text-slate-200 [&_.text-muted-foreground]:text-slate-400">
              <SavePill status={saveStatus} error={saveError} />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Member since</p>
                  <p className="font-medium mt-0.5">{formatDate(profile.created_at)}</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">License</p>
                  <p className="font-medium mt-0.5">{profile.is_license_verified ? "Verified" : "Pending"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Status alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {fromRegistry && (
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/80 dark:bg-blue-950/20 px-5 py-4 flex items-start gap-3">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">CICC registry connected</p>
              <p className="text-xs text-blue-800/80 dark:text-blue-200/80 mt-1 leading-relaxed">
                Practice details were pre-filled from your public register entry. You can edit any field — changes save automatically.
                {registry?.profile_url && (
                  <>{" "}
                    <a href={registry.profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium underline">
                      View CICC profile <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>
        )}
        {!profile.is_license_verified && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/20 px-5 py-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">License verification in progress</p>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-1 leading-relaxed">
                An administrator will confirm your CICC license. Your verified badge will appear on client-facing documents once approved.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main layout — full width two columns */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6 min-w-0">

          <SectionCard
            id="personal"
            icon={User}
            title="Personal information"
            description="Your name and contact details shown to clients in agreements and correspondence."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name *" value={name} onChange={setName} placeholder="e.g. John Smith" />
              <Field label="Phone number" value={phone} onChange={setPhone} type="tel" placeholder="+1 (416) 555-0000" />
            </div>
            <div className="mt-5">
              <Field label="Email address" value={profile.email} readOnly hint="Primary login — contact support to change" />
            </div>
          </SectionCard>

          <SectionCard
            id="professional"
            icon={BadgeCheck}
            title="Professional credentials"
            description="Regulatory details that establish your authority as a licensed immigration consultant."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="RCIC / CICC license no." value={profile.rcic_number ?? ""} readOnly hint="Assigned by administrator" />
              <Field label="CICC registered email" value={ciccEmail} onChange={setCiccEmail} type="email" placeholder="yourname@cicc.ca" />
              <Field
                label="Position / type"
                value={posType}
                onChange={setPosType}
                placeholder="e.g. RCIC, RISIA"
                hint={fromRegistry && registry?.type ? "Pre-filled from CICC registry" : undefined}
              />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">License status</label>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                  {profile.is_license_verified ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-sm font-medium text-emerald-700">Verified</span>
                      {profile.license_verified_at && (
                        <span className="text-xs text-muted-foreground">· {formatDate(profile.license_verified_at)}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="text-sm font-medium text-amber-700">Pending verification</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {registry?.languages && (
              <div className="mt-5">
                <Field label="Languages (CICC registry)" value={registry.languages} readOnly />
              </div>
            )}
          </SectionCard>

          <SectionCard
            id="company"
            icon={Building2}
            title="Company & practice"
            description="Your firm identity — appears on retainer agreements, invoices, and client communications."
          >
            <div className="flex flex-col sm:flex-row items-start gap-5 mb-6 p-4 rounded-xl border bg-muted/20">
              <div className="h-24 w-24 rounded-xl border bg-background flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {logoPreview
                  ? <img src={logoPreview} alt="Company logo" className="h-full w-full object-contain p-1" />
                  : <ImageIcon className="h-9 w-9 text-muted-foreground/50" />}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Practice logo</p>
                <p className="text-xs text-muted-foreground max-w-sm">A professional logo builds client trust on agreements and payment requests.</p>
                <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={logoUploading} className="gap-1.5">
                  {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {logoUploading ? "Uploading…" : "Upload logo"}
                </Button>
                <p className="text-[11px] text-muted-foreground">JPG, PNG or WebP · max 2 MB</p>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={fromRegistry && !profile.company_name && registry?.company ? "Company name (CICC)" : "Company name"}
                value={companyName} onChange={setCompanyName} placeholder="e.g. Smith Immigration Services"
              />
              <Field
                label={fromRegistry && !profile.company_phone && registry?.phone ? "Company phone (CICC)" : "Company phone"}
                value={companyPhone} onChange={setCompanyPhone} type="tel" placeholder="+1 (416) 555-0000"
              />
              <Field
                label={fromRegistry && !profile.company_website && registry?.website ? "Website (CICC)" : "Website"}
                value={companyWeb} onChange={setCompanyWeb} type="url" placeholder="https://example.com"
              />
            </div>
            <div className="mt-5 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">About / bio</label>
              <textarea value={companyBio} onChange={e => setCompanyBio(e.target.value)}
                placeholder="Brief description of your practice, experience, and services…" rows={4}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed" />
            </div>
          </SectionCard>

          <SectionCard
            id="address"
            icon={MapPin}
            title="Office address"
            description="Your registered office location for legal documents and client records."
          >
            <div className="space-y-5">
              <Field
                label={fromRegistry && !profile.company_address_line1 && registry?.address_line_1 ? "Address line 1 (CICC)" : "Address line 1"}
                value={addrLine1} onChange={setAddrLine1} placeholder="Street address"
              />
              <Field label="Address line 2 (optional)" value={addrLine2} onChange={setAddrLine2} placeholder="Suite, unit, floor" />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={fromRegistry && !profile.company_city && registry?.city ? "City (CICC)" : "City"} value={city} onChange={setCity} placeholder="e.g. Toronto" />
                <Field label={fromRegistry && !profile.company_province && registry?.province ? "Province (CICC)" : "Province"} value={province} onChange={setProvince} placeholder="e.g. Ontario" />
                <Field label={fromRegistry && !profile.company_postal_code && registry?.postal_code ? "Postal code (CICC)" : "Postal code"} value={postalCode} onChange={setPostalCode} placeholder="M5H 2N2" />
                <Field label="Country" value={country} onChange={setCountry} placeholder="Canada" />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="payments"
            icon={CreditCard}
            title="Client payments"
            description="Connect Stripe, PayPal, or Interac so you can send secure payment links to clients."
          >
            <AccountPaymentSettings onStripeReturn={stripeConnectReturn} />
          </SectionCard>

          <SectionCard
            id="notifications"
            icon={Bell}
            title="Notifications"
            description="Choose how you receive in-app, email, and WhatsApp alerts about client activity."
          >
            <AccountNotificationSettings />
          </SectionCard>

          <SectionCard
            id="meetings"
            icon={Video}
            title="Video meetings"
            description="Connect Google Meet, Zoom, or Microsoft Teams to schedule online consultations with clients."
          >
            <AccountMeetingSettings
              onOAuthReturn={meetOAuthReturn}
              oauthProvider={meetOAuthProvider}
              oauthStatus={meetOAuthStatus}
              oauthMessage={meetOAuthMessage}
            />
          </SectionCard>

          <SectionCard
            id="signature"
            icon={PenLine}
            title="Digital signature"
            description="Your signature on retainer agreements and official client documents."
          >
            {sigSaved && !showSigPad && (
              <div className="space-y-4">
                <div className="rounded-xl border-2 border-dashed bg-white dark:bg-muted/30 px-6 py-4 inline-block">
                  <img src={sigSaved} alt="Your digital signature" className="h-20 w-auto max-w-[360px] object-contain" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowSigPad(true)} className="gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> Replace signature
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleClearSignature} disabled={sigSaving} className="text-destructive hover:text-destructive gap-1.5">
                    {sigSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Remove
                  </Button>
                  {sigStatus === "saved" && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600"><CloudCheck className="h-3 w-3" /> Saved</span>
                  )}
                </div>
              </div>
            )}
            {(!sigSaved || showSigPad) && (
              <div className="space-y-2">
                {showSigPad && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowSigPad(false)} className="text-muted-foreground mb-1">
                    ← Keep existing
                  </Button>
                )}
                <SignaturePad onSave={handleSaveSignature} onClear={() => {}} isSaving={sigSaving} />
                {sigStatus === "saved" && <span className="flex items-center gap-1 text-xs text-emerald-600"><CloudCheck className="h-3 w-3" /> Signature saved</span>}
                {sigStatus === "error" && <span className="text-xs text-destructive">Could not save signature. Try again.</span>}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Trust sidebar */}
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold">Trust & security</p>
            </div>
            <ul className="space-y-3 text-xs text-muted-foreground leading-relaxed">
              <li className="flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                Profile changes are encrypted in transit and saved automatically.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                CICC license details are verified before the trusted consultant badge is issued.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                Client payments go directly to your connected Stripe, PayPal, or Interac account.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile summary</p>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Verification</span>
                <span className={cn("font-medium", profile.is_license_verified ? "text-emerald-600" : "text-amber-600")}>
                  {profile.is_license_verified ? "Verified" : "Pending"}
                </span>
              </div>
              {profile.rcic_number && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">License</span>
                  <span className="font-mono text-xs font-medium">{profile.rcic_number}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Member since</span>
                <span className="font-medium text-xs">{formatDate(profile.created_at)}</span>
              </div>
              {officeLine && (
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground text-xs mb-0.5">Office</p>
                  <p className="text-xs font-medium leading-snug">{officeLine}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
            <div className="flex items-start gap-2">
              <CloudCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Auto-save enabled</p>
                <p className="text-xs text-emerald-800/70 dark:text-emerald-200/70 mt-1 leading-relaxed">
                  Edits save as you type. Watch the status indicator in the header for confirmation.
                </p>
                <div className="mt-3"><SavePill status={saveStatus} error={saveError} /></div>
              </div>
            </div>
          </div>

          <nav className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm hidden xl:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">On this page</p>
            <ul className="space-y-1 text-sm">
              {[
                { id: "personal", label: "Personal" },
                { id: "professional", label: "Credentials" },
                { id: "company", label: "Company" },
                { id: "address", label: "Address" },
                { id: "payments", label: "Payments" },
                { id: "meetings", label: "Video" },
                { id: "signature", label: "Signature" },
              ].map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="block rounded-lg px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}


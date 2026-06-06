"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  User, Mail, Phone, BadgeCheck, Shield,
  Calendar, CheckCircle2, Building2, Globe, MapPin,
  Upload, ImageIcon, Loader2, CloudCheck, Info,
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
  if (!iso) return "â€”";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
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
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
      {children}
    </p>
  );
}

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
          "w-full rounded-md border px-3 py-2 text-sm transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          readOnly
            ? "bg-muted border-input text-muted-foreground cursor-not-allowed"
            : "bg-background border-input"
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
  if (status === "dirty")  return <span className="text-xs text-muted-foreground">Unsavedâ€¦</span>;
  if (status === "saving") return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" /> Savingâ€¦
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
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading profileâ€¦
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

  return (
    <div className="max-w-3xl mx-auto pb-14 space-y-6">

      {/* Page heading + save status */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Account</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Changes are saved automatically</p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <SavePill status={saveStatus} error={saveError} />
          {registry?.profile_url && (
            <a href={registry.profile_url} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Info className="h-3 w-3" /> CICC Registry
            </a>
          )}
        </div>
      </div>

      {/* Profile header */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/40 px-6 py-5 flex items-center gap-5 border-b">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar ?? ""} alt={profile.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold truncate">{name || profile.name}</p>
            <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {profile.is_license_verified ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
                  <BadgeCheck className="h-3 w-3" /> CICC Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-700 border-amber-300 gap-1">
                  <Shield className="h-3 w-3" /> Pending Verification
                </Badge>
              )}
              {profile.rcic_number && (
                <Badge variant="secondary" className="font-mono text-xs">{profile.rcic_number}</Badge>
              )}
              {registry?.status && (
                <Badge variant="outline" className={cn("text-xs", registry.entitled_to_practise ? "text-emerald-700 border-emerald-300" : "text-muted-foreground")}>
                  {registry.status}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* â”€â”€ Form body â”€â”€ */}
        <div className="px-6 py-6 space-y-8 divide-y">

          {/* Personal */}
          <div>
            <SectionLabel>Personal Information</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name *"    value={name}  onChange={setName}  placeholder="e.g. John Smith" />
              <Field label="Phone Number"   value={phone} onChange={setPhone} type="tel" placeholder="+1 (416) 555-0000" />
            </div>
            <div className="mt-4">
              <Field label="Email Address" value={profile.email} readOnly hint="Primary login email â€” contact support to change" />
            </div>
          </div>

          {/* Professional */}
          <div className="pt-6">
            <SectionLabel>Professional Details</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="RCIC / CICC License No." value={profile.rcic_number ?? ""} readOnly hint="Assigned by administrator" />
              <Field label="CICC Registered Email"   value={ciccEmail} onChange={setCiccEmail} type="email" placeholder="yourname@cicc.ca" />
              <Field
                label="Position / Type"
                value={posType}
                onChange={setPosType}
                placeholder="e.g. RCIC, RISIAâ€¦"
                hint={fromRegistry && registry?.type ? "Pre-filled from CICC registry" : undefined}
              />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">License Status</label>
                <div className="flex items-center gap-2 pt-1.5">
                  {profile.is_license_verified ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700 font-medium">Verified</span>
                      {profile.license_verified_at && (
                        <span className="text-xs text-muted-foreground">on {formatDate(profile.license_verified_at)}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-amber-700 font-medium">Pending verification</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {registry?.languages && (
              <div className="mt-4">
                <Field label="Languages (CICC registry)" value={registry.languages} readOnly />
              </div>
            )}
          </div>

          {/* Company */}
          <div className="pt-6">
            <SectionLabel>Company &amp; Practice</SectionLabel>

            {/* Logo */}
            <div className="flex items-center gap-4 mb-6">
              <div className="h-20 w-20 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview
                  ? <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                  : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
              </div>
              <div className="space-y-1.5">
                <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={logoUploading} className="gap-1.5">
                  {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {logoUploading ? "Uploadingâ€¦" : "Upload Logo"}
                </Button>
                <p className="text-xs text-muted-foreground">JPG, PNG or WebP Â· max 2 MB</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={fromRegistry && !profile.company_name && registry?.company ? "Company Name (from CICC registry)" : "Company Name"}
                value={companyName} onChange={setCompanyName} placeholder="e.g. Smith Immigration Services"
              />
              <Field
                label={fromRegistry && !profile.company_phone && registry?.phone ? "Company Phone (from CICC registry)" : "Company Phone"}
                value={companyPhone} onChange={setCompanyPhone} type="tel" placeholder="+1 (416) 555-0000"
              />
              <Field
                label={fromRegistry && !profile.company_website && registry?.website ? "Website (from CICC registry)" : "Website"}
                value={companyWeb} onChange={setCompanyWeb} type="url" placeholder="https://example.com"
              />
            </div>
            <div className="mt-4 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">About / Bio</label>
              <textarea value={companyBio} onChange={e => setCompanyBio(e.target.value)}
                placeholder="Brief description of your practice and servicesâ€¦" rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
          </div>

          {/* Address */}
          <div className="pt-6">
            <SectionLabel>Office Address</SectionLabel>
            <div className="space-y-4">
              <Field
                label={fromRegistry && !profile.company_address_line1 && registry?.address_line_1 ? "Address Line 1 (from CICC registry)" : "Address Line 1"}
                value={addrLine1} onChange={setAddrLine1} placeholder="Street address"
              />
              <Field label="Address Line 2 (optional)" value={addrLine2} onChange={setAddrLine2} placeholder="Suite, unit, floor" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={fromRegistry && !profile.company_city && registry?.city ? "City (from CICC registry)" : "City"} value={city} onChange={setCity} placeholder="e.g. Toronto" />
                <Field label={fromRegistry && !profile.company_province && registry?.province ? "Province (from CICC registry)" : "Province"} value={province} onChange={setProvince} placeholder="e.g. Ontario" />
                <Field label={fromRegistry && !profile.company_postal_code && registry?.postal_code ? "Postal Code (from CICC registry)" : "Postal Code"} value={postalCode} onChange={setPostalCode} placeholder="M5H 2N2" />
                <Field label="Country" value={country} onChange={setCountry} placeholder="Canada" />
              </div>
            </div>
          </div>

          {/* Account meta */}
          <div className="pt-6">
            <SectionLabel>Account</SectionLabel>
            <div className="flex items-center gap-3 py-1">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Member since</p>
                <p className="text-sm font-medium">{formatDate(profile.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Digital Signature */}
          <div className="pt-6">
            <SectionLabel>Digital Signature</SectionLabel>
            <p className="text-xs text-muted-foreground mb-4">
              This signature will appear on retainer agreements and client documents you generate.
            </p>

            {/* Saved signature preview */}
            {sigSaved && !showSigPad && (
              <div className="space-y-3">
                <div className="rounded-lg border bg-white px-4 py-3 inline-block">
                  <img
                    src={sigSaved}
                    alt="Your digital signature"
                    className="h-20 w-auto max-w-[340px] object-contain"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSigPad(true)}
                    className="gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" /> Replace Signature
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSignature}
                    disabled={sigSaving}
                    className="text-destructive hover:text-destructive gap-1.5"
                  >
                    {sigSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Remove
                  </Button>
                  {sigStatus === "saved" && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <CloudCheck className="h-3 w-3" /> Saved
                    </span>
                  )}
                  {sigStatus === "error" && (
                    <span className="text-xs text-destructive">Save failed</span>
                  )}
                </div>
              </div>
            )}

            {/* Signature pad */}
            {(!sigSaved || showSigPad) && (
              <div className="space-y-2">
                {showSigPad && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSigPad(false)}
                    className="text-muted-foreground mb-1"
                  >
                    ← Keep existing
                  </Button>
                )}
                <SignaturePad
                  onSave={handleSaveSignature}
                  onClear={() => {}}
                  isSaving={sigSaving}
                />
                {sigStatus === "saved" && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CloudCheck className="h-3 w-3" /> Signature saved!
                  </span>
                )}
                {sigStatus === "error" && (
                  <span className="text-xs text-destructive">Could not save signature. Try again.</span>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* CICC registry banner */}
      {fromRegistry && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">CICC Registry data loaded</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Some fields were pre-filled from your CICC public register entry (license {profile.rcic_number}).
              All fields are editable â€” changes save automatically.
              {registry?.profile_url && (
                <> <a href={registry.profile_url} target="_blank" rel="noopener noreferrer" className="underline font-medium">View CICC profile â†’</a></>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Pending verification banner */}
      {!profile.is_license_verified && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">License verification pending</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your CICC license has not been verified yet. Once confirmed by an administrator, your account will receive the &ldquo;CICC Verified&rdquo; badge.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}


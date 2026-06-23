"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccountPaymentSettings } from "./account-payment-settings";
import { AccountMeetingSettings } from "./account-meeting-settings";
import { AccountNotificationSettings } from "./account-notification-settings";
import { AccountPasswordSettings } from "./account-password-settings";
import {
  User,
  Mail,
  BadgeCheck,
  Shield,
  CheckCircle2,
  Building2,
  MapPin,
  Upload,
  ImageIcon,
  Loader2,
  CloudCheck,
  Info,
  Lock,
  PenLine,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function SettingsBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground break-words">{description}</p>
        )}
      </div>
      {children}
    </div>
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

function ProfileField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly = false,
  hint,
  id,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  hint?: string;
  id?: string;
}) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Input
        id={fieldId}
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={cn("h-10", readOnly && "bg-muted/40 text-muted-foreground")}
      />
      {hint && <p className="text-xs text-muted-foreground break-words">{hint}</p>}
    </div>
  );
}

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

function SaveIndicator({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === "idle") return null;
  if (status === "dirty")
    return <span className="text-xs text-muted-foreground">Unsaved changes</span>;
  if (status === "saving")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Saving
      </span>
    );
  if (status === "saved")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <CloudCheck className="size-3.5" />
        All changes saved
      </span>
    );
  return <span className="text-xs text-destructive">{error ?? "Save failed"}</span>;
}

function SignaturePad({
  onSave,
  onClear,
  isSaving,
}: {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
  isSaving: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const sx = c.width / rect.width;
    const sy = c.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * sx,
        y: (e.touches[0].clientY - rect.top) * sy,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * sx,
      y: ((e as React.MouseEvent).clientY - rect.top) * sy,
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
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
    setIsEmpty(false);
  }

  function endDraw() {
    drawing.current = false;
    lastPos.current = null;
  }

  function clearCanvas() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setIsEmpty(true);
    onClear();
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border border-dashed bg-background">
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full cursor-crosshair bg-white"
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
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Sign here with your mouse or finger
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="sm"
          className="h-9 w-full sm:w-auto"
          onClick={() => onSave(canvasRef.current!.toDataURL("image/png"))}
          disabled={isEmpty || isSaving}
        >
          {isSaving ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <CloudCheck className="mr-1.5 size-3.5" />
          )}
          {isSaving ? "Saving…" : "Save signature"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-full sm:w-auto"
          onClick={clearCanvas}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}

export function AccountClient() {
  const searchParams = useSearchParams();
  const stripeConnectReturn = searchParams.get("stripe_connect") === "return";
  const meetOAuthReturn = searchParams.has("meet_oauth");
  const meetOAuthProvider = searchParams.get("meet_oauth");
  const meetOAuthStatus = searchParams.get("status");
  const meetOAuthMessage = searchParams.get("message");
  const [profile, setProfile] = useState<ConsultantProfile | null>(null);
  const [registry, setRegistry] = useState<RcicRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ciccEmail, setCiccEmail] = useState("");
  const [posType, setPosType] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [companyBio, setCompanyBio] = useState("");
  const [companyWeb, setCompanyWeb] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("Canada");

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [sigSaved, setSigSaved] = useState<string | null>(null);
  const [sigSaving, setSigSaving] = useState(false);
  const [sigStatus, setSigStatus] = useState<"idle" | "saved" | "error">("idle");
  const [showSigPad, setShowSigPad] = useState(false);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const firstLoad = useRef(true);

  useEffect(() => {
    async function load() {
      try {
        const [pRes, rRes] = await Promise.all([
          fetch(`${API}/consultant/profile`, { headers: authHeaders() }),
          fetch(`${API}/consultant/rcic-registry`, { headers: authHeaders() }),
        ]);
        const prof: ConsultantProfile = await pRes.json();
        const reg: RcicRegistry | null = rRes.ok ? await rRes.json() : null;

        setProfile(prof);
        setRegistry(reg);

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

  useEffect(() => {
    const tab = searchParams.get("tab");
    const validTabs = ["profile", "practice", "integrations", "security"];
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab);
    } else if (typeof window !== "undefined" && window.location.hash === "#notifications") {
      setActiveTab("integrations");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && activeTab === "integrations" && typeof window !== "undefined" && window.location.hash === "#notifications") {
      requestAnimationFrame(() => {
        document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [loading, activeTab]);

  const doSave = useCallback(async (vals: Record<string, string>) => {
    if (!vals.name.trim()) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch(`${API}/consultant/profile`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          name: vals.name,
          phone: vals.phone || null,
          cicc_email: vals.ciccEmail || null,
          company_name: vals.companyName || null,
          company_bio: vals.companyBio || null,
          company_website: vals.companyWeb || null,
          company_phone: vals.companyPhone || null,
          company_address_line1: vals.addrLine1 || null,
          company_address_line2: vals.addrLine2 || null,
          company_city: vals.city || null,
          company_province: vals.province || null,
          company_postal_code: vals.postalCode || null,
          company_country: vals.country || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.errors
          ? Object.values(json.errors as Record<string, string[]>).flat()[0]
          : json?.message;
        setSaveError(msg ?? "Save failed");
        setSaveStatus("error");
        return;
      }
      setProfile(json as ConsultantProfile);
      try {
        const raw = localStorage.getItem("wtc_consultant_user");
        localStorage.setItem(
          "wtc_consultant_user",
          JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), name: json.name }),
        );
      } catch {
        /* optional */
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 3000);
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
      doSave({
        name,
        phone,
        ciccEmail,
        companyName,
        companyBio,
        companyWeb,
        companyPhone,
        addrLine1,
        addrLine2,
        city,
        province,
        postalCode,
        country,
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(autoSaveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    name,
    phone,
    ciccEmail,
    companyName,
    companyBio,
    companyWeb,
    companyPhone,
    addrLine1,
    addrLine2,
    city,
    province,
    postalCode,
    country,
  ]);

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch(`${API}/consultant/profile/logo`, {
        method: "POST",
        headers: authHeaders(false),
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.message ?? "Upload failed");
        setSaveStatus("error");
        return;
      }
      setLogoPreview(json.company_logo);
      setProfile((prev) => (prev ? { ...prev, company_logo: json.company_logo } : prev));
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
      const res = await fetch(`${API}/consultant/profile/signature`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ signature: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSigStatus("error");
        return;
      }
      setSigSaved(json.digital_signature);
      setSigStatus("saved");
      setShowSigPad(false);
      setTimeout(() => setSigStatus((s) => (s === "saved" ? "idle" : s)), 3000);
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

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading account…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-destructive">
        Could not load your profile. Please refresh the page.
      </div>
    );
  }

  const initials = getInitials(profile.name ?? "C");
  const fromRegistry = registry !== null;
  const officeLine = [addrLine1, city, province, postalCode, country].filter(Boolean).join(", ");

  return (
    <div className="min-w-0 w-full space-y-4 overflow-x-hidden px-3 pb-10 sm:space-y-6 sm:px-0 sm:pb-12">
      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Account settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your consultant profile, practice details, and connected services.
          </p>
        </div>
        <SaveIndicator status={saveStatus} error={saveError} />
      </div>

      {/* Identity card */}
      <div className="rounded-lg border bg-card">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
          <Avatar className="size-16 shrink-0 ring-1 ring-border sm:size-20">
            <AvatarImage src={profile.avatar ?? logoPreview ?? ""} alt={profile.name} />
            <AvatarFallback className="bg-muted text-base font-medium text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-lg font-semibold leading-tight break-words text-foreground">
                {name || profile.name}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="size-3.5 shrink-0" />
                <span className="min-w-0 break-all">{profile.email}</span>
              </p>
              {companyName && (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="size-3.5 shrink-0" />
                  <span className="min-w-0 break-words">{companyName}</span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {profile.is_license_verified ? (
                <Badge variant="secondary" className="gap-1 font-normal">
                  <BadgeCheck className="size-3.5 text-emerald-600" />
                  CICC verified
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 font-normal text-amber-700">
                  <Shield className="size-3.5" />
                  Verification pending
                </Badge>
              )}
              {profile.rcic_number && (
                <Badge variant="outline" className="font-mono text-xs font-normal">
                  {profile.rcic_number}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Member since {formatDate(profile.created_at)}
              </span>
            </div>
          </div>
        </div>

        {(fromRegistry || !profile.is_license_verified) && (
          <>
            <Separator />
            <div className="space-y-3 p-4 sm:p-6">
              {fromRegistry && (
                <div className="flex gap-3 text-sm">
                  <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="min-w-0 break-words text-muted-foreground leading-relaxed">
                    Practice details were imported from the CICC public register. You may edit any
                    field — changes save automatically.
                    {registry?.profile_url && (
                      <>
                        {" "}
                        <a
                          href={registry.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          View CICC profile
                          <ExternalLink className="size-3" />
                        </a>
                      </>
                    )}
                  </p>
                </div>
              )}
              {!profile.is_license_verified && (
                <div className="flex gap-3 text-sm">
                  <Shield className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <p className="min-w-0 break-words text-muted-foreground leading-relaxed">
                    Your license is being reviewed by our team. Once approved, your verified status
                    will appear on client-facing documents.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Settings tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4 sm:gap-6">
        <TabsList className="!h-auto grid w-full grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1 sm:inline-flex sm:w-auto sm:grid-cols-none sm:gap-0.5 sm:border-transparent sm:bg-muted sm:p-[3px]">
          {[
            { value: "profile", label: "Profile", icon: User },
            { value: "practice", label: "Practice", icon: Building2 },
            { value: "integrations", label: "Integrations", icon: CreditCard },
            { value: "security", label: "Security", icon: Lock },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "h-9 min-w-0 flex-none gap-1.5 rounded-sm px-2 text-xs font-medium shadow-none after:hidden",
                "w-full sm:w-auto sm:flex-initial sm:px-3 sm:text-sm",
                "border-0 data-[state=active]:border-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none",
                "dark:data-[state=active]:border-0 dark:data-[state=active]:bg-background",
              )}
            >
              <tab.icon className="size-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Profile tab */}
        <TabsContent value="profile" className="mt-0 space-y-6 sm:space-y-8">
          <SettingsBlock
            title="Personal details"
            description="Shown on retainer agreements and client correspondence."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <ProfileField
                label="Full name"
                value={name}
                onChange={setName}
                placeholder="e.g. John Smith"
              />
              <ProfileField
                label="Phone"
                value={phone}
                onChange={setPhone}
                type="tel"
                placeholder="+1 (416) 555-0000"
              />
            </div>
            <ProfileField
              label="Login email"
              value={profile.email}
              readOnly
              hint="Contact support if you need to change your login email."
            />
          </SettingsBlock>

          <Separator />

          <SettingsBlock
            title="Professional credentials"
            description="Regulatory information associated with your CICC licence."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <ProfileField
                label="RCIC / CICC licence number"
                value={profile.rcic_number ?? ""}
                readOnly
                hint="Assigned by your administrator."
              />
              <ProfileField
                label="CICC registered email"
                value={ciccEmail}
                onChange={setCiccEmail}
                type="email"
                placeholder="yourname@cicc.ca"
              />
              <ProfileField
                label="Position / designation"
                value={posType}
                onChange={setPosType}
                placeholder="e.g. RCIC, RISIA"
                hint={
                  fromRegistry && registry?.type ? "Imported from CICC register" : undefined
                }
              />
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-medium">Licence status</Label>
                <div className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 rounded-md border bg-muted/30 px-3 py-2 sm:h-10 sm:flex-nowrap sm:py-0">
                  {profile.is_license_verified ? (
                    <>
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      <span className="text-sm">Verified</span>
                      {profile.license_verified_at && (
                        <span className="text-xs text-muted-foreground sm:truncate">
                          · {formatDate(profile.license_verified_at)}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <Shield className="size-4 shrink-0 text-amber-500" />
                      <span className="text-sm">Pending review</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {registry?.languages && (
              <ProfileField
                label="Languages (CICC register)"
                value={registry.languages}
                readOnly
              />
            )}
          </SettingsBlock>
        </TabsContent>

        {/* Practice tab */}
        <TabsContent value="practice" className="mt-0 space-y-6 sm:space-y-8">
          <SettingsBlock
            title="Firm identity"
            description="Used on agreements, invoices, and payment requests sent to clients."
          >
            <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-start">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Company logo"
                    className="size-full object-contain p-1"
                  />
                ) : (
                  <ImageIcon className="size-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium">Practice logo</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  JPG, PNG, or WebP · max 2 MB
                </p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleLogoUpload(f);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-10 w-full sm:w-auto"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                >
                  {logoUploading ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 size-3.5" />
                  )}
                  {logoUploading ? "Uploading…" : "Upload logo"}
                </Button>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <ProfileField
                label={
                  fromRegistry && !profile.company_name && registry?.company
                    ? "Company name (CICC)"
                    : "Company name"
                }
                value={companyName}
                onChange={setCompanyName}
                placeholder="e.g. Smith Immigration Services"
              />
              <ProfileField
                label={
                  fromRegistry && !profile.company_phone && registry?.phone
                    ? "Company phone (CICC)"
                    : "Company phone"
                }
                value={companyPhone}
                onChange={setCompanyPhone}
                type="tel"
              />
              <ProfileField
                label={
                  fromRegistry && !profile.company_website && registry?.website
                    ? "Website (CICC)"
                    : "Website"
                }
                value={companyWeb}
                onChange={setCompanyWeb}
                type="url"
                placeholder="https://"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-bio" className="text-sm font-medium">
                About your practice
              </Label>
              <Textarea
                id="company-bio"
                value={companyBio}
                onChange={(e) => setCompanyBio(e.target.value)}
                placeholder="Brief description of your services and experience…"
                rows={4}
                className="resize-none leading-relaxed"
              />
            </div>
          </SettingsBlock>

          <Separator />

          <SettingsBlock
            title="Office address"
            description="Registered office location for legal documents and client records."
          >
            <div className="space-y-5">
              <ProfileField
                label={
                  fromRegistry && !profile.company_address_line1 && registry?.address_line_1
                    ? "Address line 1 (CICC)"
                    : "Address line 1"
                }
                value={addrLine1}
                onChange={setAddrLine1}
                placeholder="Street address"
              />
              <ProfileField
                label="Address line 2"
                value={addrLine2}
                onChange={setAddrLine2}
                placeholder="Suite, unit, floor (optional)"
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <ProfileField
                  label={
                    fromRegistry && !profile.company_city && registry?.city ? "City (CICC)" : "City"
                  }
                  value={city}
                  onChange={setCity}
                />
                <ProfileField
                  label={
                    fromRegistry && !profile.company_province && registry?.province
                      ? "Province (CICC)"
                      : "Province"
                  }
                  value={province}
                  onChange={setProvince}
                />
                <ProfileField
                  label={
                    fromRegistry && !profile.company_postal_code && registry?.postal_code
                      ? "Postal code (CICC)"
                      : "Postal code"
                  }
                  value={postalCode}
                  onChange={setPostalCode}
                />
                <ProfileField label="Country" value={country} onChange={setCountry} />
              </div>
              {officeLine && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  <span>{officeLine}</span>
                </p>
              )}
            </div>
          </SettingsBlock>

          <Separator />

          <SettingsBlock
            title="Digital signature"
            description="Applied to retainer agreements and official client documents."
          >
            {sigSaved && !showSigPad ? (
              <div className="space-y-4">
                <div className="inline-block rounded-lg border bg-white px-6 py-4 dark:bg-muted/20">
                  <img
                    src={sigSaved}
                    alt="Your digital signature"
                    className="h-16 w-auto max-w-full object-contain sm:h-20"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-full sm:w-auto"
                    onClick={() => setShowSigPad(true)}
                  >
                    <PenLine className="mr-1.5 size-3.5" />
                    Replace signature
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-full text-destructive hover:text-destructive sm:w-auto"
                    onClick={() => void handleClearSignature()}
                    disabled={sigSaving}
                  >
                    {sigSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                    Remove
                  </Button>
                  {sigStatus === "saved" && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <CloudCheck className="size-3.5" />
                      Saved
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {showSigPad && sigSaved && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-muted-foreground"
                    onClick={() => setShowSigPad(false)}
                  >
                    Cancel
                  </Button>
                )}
                <SignaturePad
                  onSave={handleSaveSignature}
                  onClear={() => {}}
                  isSaving={sigSaving}
                />
                {sigStatus === "saved" && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                    <CloudCheck className="size-3.5" />
                    Signature saved
                  </span>
                )}
                {sigStatus === "error" && (
                  <span className="text-xs text-destructive">
                    Could not save signature. Please try again.
                  </span>
                )}
              </div>
            )}
          </SettingsBlock>
        </TabsContent>

        {/* Integrations tab */}
        <TabsContent value="integrations" className="mt-0 space-y-8 sm:space-y-10">
          <SettingsBlock
            title="Client payments"
            description="Connect Stripe, PayPal, or Interac to collect fees from clients."
          >
            <AccountPaymentSettings onStripeReturn={stripeConnectReturn} />
          </SettingsBlock>

          <Separator />

          <SettingsBlock
            title="Video meetings"
            description="Link Google Meet, Zoom, or Microsoft Teams for client consultations."
          >
            <AccountMeetingSettings
              onOAuthReturn={meetOAuthReturn}
              oauthProvider={meetOAuthProvider}
              oauthStatus={meetOAuthStatus}
              oauthMessage={meetOAuthMessage}
            />
          </SettingsBlock>

          <Separator />

          <div id="notifications">
            <SettingsBlock
              title="Notifications"
              description="Control in-app, email, and WhatsApp alerts."
            >
              <AccountNotificationSettings />
            </SettingsBlock>
          </div>
        </TabsContent>

        {/* Security tab */}
        <TabsContent value="security" className="mt-0 space-y-6 sm:space-y-8">
          <SettingsBlock
            title="Password & sign-in"
            description="Set or update your password. Google sign-in remains available if connected."
          >
            <AccountPasswordSettings />
          </SettingsBlock>

          <Separator />

          <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-foreground" />
              <div className="min-w-0 space-y-1 leading-relaxed">
                <p className="font-medium text-foreground">Data protection</p>
                <p className="break-words">
                  Profile changes are encrypted in transit. Client payments are processed directly
                  through your connected payment provider — RCICMASTER does not hold client funds.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

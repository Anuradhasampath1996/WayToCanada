"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Receipt,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { adminAuthHeaders } from "@/lib/admin-auth";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type CompanySettings = {
  legal_name: string | null;
  trade_name: string | null;
  business_number: string | null;
  gst_hst_number: string | null;
  qst_number: string | null;
  pst_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  billing_email: string | null;
  support_email: string | null;
  website: string | null;
  invoice_footer: string | null;
  invoice_prefix: string | null;
  logo_url: string | null;
  updated_at: string | null;
};

const PROVINCES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
];

export default function CompanyInvoiceSettingsPage() {
  const [form, setForm] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/admin/platform-company`, { headers: adminAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load settings");
      setForm(json.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load company settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`${API}/admin/platform-company`, {
        method: "PUT",
        headers: adminAuthHeaders(),
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Save failed");
      setForm(json.data);
      setMessage(json.message ?? "Settings saved.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch(`${API}/admin/platform-company/logo`, {
        method: "POST",
        headers: adminAuthHeaders(),
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Upload failed");
      setForm(json.data);
      setMessage("Logo uploaded. New invoices will include this logo.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Logo upload failed");
    } finally {
      setUploading(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  }

  async function removeLogo() {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/admin/platform-company/logo`, {
        method: "DELETE",
        headers: adminAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Remove failed");
      setForm(json.data);
      setMessage("Logo removed.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not remove logo");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading company settings…
      </div>
    );
  }

  if (!form) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error ?? "Could not load company settings."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Building2 className="h-6 w-6 text-emerald-600" />
          Company &amp; Invoice Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Legal company details used on subscription tax invoices. Changes apply immediately to all newly
          downloaded invoices — no re-generation of past records required.
        </p>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> Company logo
          </CardTitle>
          <CardDescription>Displayed on PDF tax invoices (PNG/JPG, max 2 MB)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          {form.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logo_url} alt="Company logo" className="h-16 max-w-[180px] object-contain rounded border bg-white p-2" />
          ) : (
            <div className="flex h-16 w-32 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
              No logo
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={logoRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo(f);
              }}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => logoRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload logo"}
            </Button>
            {form.logo_url && (
              <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={removeLogo}>
                <Trash2 className="h-4 w-4 mr-1" /> Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Legal identity</CardTitle>
          <CardDescription>Registered business name and CRA tax registration numbers</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal name" value={form.legal_name ?? ""} onChange={(v) => setField("legal_name", v)} placeholder="RCICMASTER Inc." />
          <Field label="Trade name (brand)" value={form.trade_name ?? ""} onChange={(v) => setField("trade_name", v)} placeholder="RCICMASTER" />
          <Field label="Business Number (BN)" value={form.business_number ?? ""} onChange={(v) => setField("business_number", v)} placeholder="123456789 RT0001" />
          <Field label="GST/HST registration no." value={form.gst_hst_number ?? ""} onChange={(v) => setField("gst_hst_number", v)} placeholder="123456789 RT0001" />
          <Field label="QST number (Quebec)" value={form.qst_number ?? ""} onChange={(v) => setField("qst_number", v)} />
          <Field label="PST number (if applicable)" value={form.pst_number ?? ""} onChange={(v) => setField("pst_number", v)} />
          <Field label="Invoice prefix" value={form.invoice_prefix ?? ""} onChange={(v) => setField("invoice_prefix", v)} placeholder="RCM" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business address</CardTitle>
          <CardDescription>Supplier address shown on invoices (place of business)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Address line 1" value={form.address_line1 ?? ""} onChange={(v) => setField("address_line1", v)} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Address line 2" value={form.address_line2 ?? ""} onChange={(v) => setField("address_line2", v)} />
          </div>
          <Field label="City" value={form.city ?? ""} onChange={(v) => setField("city", v)} />
          <div className="space-y-2">
            <Label>Province</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.province ?? ""}
              onChange={(e) => setField("province", e.target.value)}
            >
              <option value="">Select…</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <Field label="Postal code" value={form.postal_code ?? ""} onChange={(v) => setField("postal_code", v)} />
          <Field label="Country" value={form.country ?? "CA"} onChange={(v) => setField("country", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" value={form.phone ?? ""} onChange={(v) => setField("phone", v)} />
          <Field label="Website" value={form.website ?? ""} onChange={(v) => setField("website", v)} />
          <Field label="Billing email" value={form.billing_email ?? ""} onChange={(v) => setField("billing_email", v)} type="email" />
          <Field label="Support email" value={form.support_email ?? ""} onChange={(v) => setField("support_email", v)} type="email" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Invoice footer
          </CardTitle>
          <CardDescription>Legal disclaimer and notes printed at the bottom of every invoice PDF</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            value={form.invoice_footer ?? ""}
            onChange={(e) => setField("invoice_footer", e.target.value)}
            placeholder="Thank you for your business. This tax invoice is issued in accordance with CRA requirements…"
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <span>
          Consultant billing address and tax amounts come from each payment record. Company details above update all future PDF downloads.
        </span>
        {form.updated_at && (
          <span>Last saved: {new Date(form.updated_at).toLocaleString("en-CA")}</span>
        )}
      </div>

      <Button onClick={save} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save company settings
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

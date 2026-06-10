"use client";

import * as React from "react";
import Image from "next/image";
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Save,
  Webhook,
  Zap,
  Copy,
  Check,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { TestClockPanel } from "./test-clock-panel";

const API = process.env.NEXT_PUBLIC_API_URL + "/api/v1";

type GatewayData = {
  id: number;
  gateway: "stripe" | "paypal";
  mode: "test" | "production";
  is_active: boolean;
  has_publishable: boolean;
  has_secret: boolean;
  publishable_key_preview: string | null;
  secret_key_preview: string | null;
  has_webhook: boolean;
  webhook_preview: string | null;
  updated_at: string;
};

type FormState = {
  mode: "test" | "production";
  is_active: boolean;
  publishable_key: string;
  secret_key: string;
  webhook_id: string;
};

type TestResult = {
  success: boolean;
  message: string;
  account?: {
    id: string;
    display_name: string | null;
    country: string | null;
    livemode: boolean;
  };
};

function authHeaders() { return adminAuthHeaders("application/json"); }

function StripeLogo({ className = "h-8" }: { className?: string }) {
  return (
    <Image
      src="/images/stripe-logo.svg"
      alt="Stripe"
      width={80}
      height={32}
      className={`w-auto object-contain ${className}`}
      priority
    />
  );
}

function KeyField({
  label,
  hint,
  placeholder,
  value,
  onChange,
  hasSaved,
  savedPreview,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hasSaved: boolean;
  savedPreview: string | null;
}) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="space-y-2 min-w-0">
      <Label>{label}</Label>
      {hasSaved && savedPreview && (
        <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs text-emerald-700">
          <CheckCircle2 className="size-3 shrink-0" />
          <span className="font-mono truncate">{savedPreview}</span>
        </span>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          className="pr-10 font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function GatewayCard({
  data,
  onSaved,
}: {
  data: GatewayData;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<FormState>({
    mode: data.mode,
    is_active: data.is_active,
    publishable_key: "",
    secret_key: "",
    webhook_id: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [toast, setToast] = React.useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [testResult, setTestResult] = React.useState<TestResult | null>(null);
  const [confirmClear, setConfirmClear] = React.useState(false);

  const webhookUrl =
    (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") +
    "/api/v1/webhooks/stripe";

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSave() {
    setSaving(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API}/admin/payment-gateways/${data.gateway}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          mode: form.mode,
          is_active: form.is_active,
          publishable_key: form.publishable_key || null,
          secret_key: form.secret_key || null,
          webhook_id: form.webhook_id || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Save failed");
      showToast("success", json.message);
      setForm((f) => ({ ...f, publishable_key: "", secret_key: "" }));
      onSaved();
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API}/admin/payment-gateways/${data.gateway}/test`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          secret_key: form.secret_key || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTestResult({ success: false, message: json.message || "Connection failed." });
        return;
      }
      setTestResult(json);
    } catch (e: unknown) {
      setTestResult({
        success: false,
        message: e instanceof Error ? e.message : "Connection test failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleClearKeys() {
    setClearing(true);
    try {
      const res = await fetch(
        `${API}/admin/payment-gateways/${data.gateway}/keys`,
        { method: "DELETE", headers: authHeaders() }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Clear failed");
      showToast("success", json.message);
      setTestResult(null);
      onSaved();
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : "An error occurred");
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const canTest = form.secret_key.trim() !== "" || data.has_secret;

  return (
    <>
      <Card className="overflow-hidden border-0 shadow-sm">
        {/* Branded header */}
        <div className="bg-gradient-to-r from-[#635BFF] to-[#7A73FF] px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white rounded-lg px-4 py-2.5 shadow-sm">
                <StripeLogo className="h-7" />
              </div>
              <div className="text-white">
                <p className="font-semibold text-sm opacity-90">Payment Gateway</p>
                <p className="text-xs opacity-75">Consultant subscription billing</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={
                  data.is_active
                    ? "bg-white/20 text-white border-white/30 hover:bg-white/20"
                    : "bg-black/20 text-white/80 border-white/20 hover:bg-black/20"
                }
              >
                {data.is_active ? "Active" : "Inactive"}
              </Badge>
              <Badge
                className={
                  data.mode === "production"
                    ? "bg-orange-500/90 text-white border-0 hover:bg-orange-500/90"
                    : "bg-white/20 text-white border-white/30 hover:bg-white/20"
                }
              >
                {data.mode === "production" ? "Live" : "Test"}
              </Badge>
            </div>
          </div>
        </div>

        <CardHeader className="pb-0 pt-5">
          {toast && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm mb-4 ${
                toast.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              {toast.msg}
            </div>
          )}

          {testResult && (
            <div
              className={`rounded-lg px-4 py-3 text-sm mb-4 border ${
                testResult.success
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}
            >
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="size-4 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="font-medium">{testResult.message}</p>
                  {testResult.success && testResult.account && (
                    <p className="text-xs mt-1 opacity-80">
                      Account: {testResult.account.display_name ?? testResult.account.id}
                      {testResult.account.country && ` · ${testResult.account.country}`}
                      {` · ${testResult.account.livemode ? "Live" : "Test"} mode`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {/* Quick toggles */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3.5">
              <div>
                <p className="text-sm font-medium">Enable Gateway</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Allow consultant subscriptions
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>

            <div className="rounded-xl border bg-muted/30 px-4 py-3.5 space-y-2">
              <Label className="text-sm">Environment</Label>
              <Select
                value={form.mode}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, mode: v as "test" | "production" }))
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test — pk_test_ / sk_test_</SelectItem>
                  <SelectItem value="production">Production — pk_live_ / sk_live_</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.mode === "production" && (
            <p className="text-orange-600 text-xs flex items-center gap-1.5 -mt-2">
              <AlertCircle className="size-3.5 shrink-0" />
              Production mode charges real money. Verify your keys carefully.
            </p>
          )}

          <Separator />

          {/* API Keys */}
          <div>
            <h3 className="text-sm font-semibold mb-1">API Keys</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Get keys from{" "}
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#635BFF] hover:underline"
              >
                Stripe Dashboard → API Keys
              </a>
              . Leave fields blank to keep existing saved keys.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <KeyField
                label="Publishable Key"
                placeholder="pk_test_…"
                value={form.publishable_key}
                onChange={(v) => setForm((f) => ({ ...f, publishable_key: v }))}
                hasSaved={data.has_publishable}
                savedPreview={data.publishable_key_preview}
              />
              <KeyField
                label="Secret Key"
                placeholder="sk_test_…"
                value={form.secret_key}
                onChange={(v) => setForm((f) => ({ ...f, secret_key: v }))}
                hasSaved={data.has_secret}
                savedPreview={data.secret_key_preview}
              />
            </div>
          </div>

          <Separator />

          {/* Webhook */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Webhook className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Webhook (optional)</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Required for auto-renewal events. Add this URL in Stripe Dashboard → Webhooks.
            </p>

            <div className="flex items-center gap-2 mb-4">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg break-all font-mono">
                {webhookUrl}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={copyWebhookUrl}
              >
                {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
              </Button>
            </div>

            <KeyField
              label="Signing Secret"
              hint="Events: checkout.session.completed, invoice.paid, customer.subscription.updated, customer.subscription.deleted"
              placeholder="whsec_…"
              value={form.webhook_id}
              onChange={(v) => setForm((f) => ({ ...f, webhook_id: v }))}
              hasSaved={data.has_webhook}
              savedPreview={data.webhook_preview}
            />
          </div>

          {/* Security note */}
          <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <Shield className="size-4 mt-0.5 shrink-0 text-[#635BFF]" />
            <span>
              Keys are encrypted with AES-256. Only the last 4 characters are shown here.
            </span>
          </div>

          {data.updated_at && (
            <p className="text-muted-foreground text-xs">
              Last saved:{" "}
              {new Date(data.updated_at).toLocaleString("en-CA", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !canTest}
              className="gap-2"
            >
              {testing ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Zap className="size-4" />
              )}
              Test Connection
            </Button>

            <Button onClick={handleSave} disabled={saving} className="gap-2 flex-1 sm:flex-none">
              {saving ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save Settings
            </Button>

            {(data.has_publishable || data.has_secret) && (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10 border-destructive/40 ml-auto"
                onClick={() => setConfirmClear(true)}
                disabled={clearing}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Stripe Keys?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the stored Stripe API keys and
              deactivate the gateway. You will need to re-enter them to use
              Stripe again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearKeys}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {clearing ? (
                <RefreshCw className="size-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="size-4 mr-2" />
              )}
              Clear Keys
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function PaymentGatewayPage() {
  const [gateways, setGateways] = React.useState<GatewayData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  async function fetchGateways() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/admin/payment-gateways`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load payment gateway settings.");
      const json = await res.json();
      setGateways(json.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchGateways();
  }, []);

  const stripe = gateways.find((g) => g.gateway === "stripe");

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment Gateway</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect Stripe to accept consultant subscription payments.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <RefreshCw className="size-5 animate-spin" />
          Loading…
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={fetchGateways}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && stripe && (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <GatewayCard data={stripe} onSaved={fetchGateways} />
          {stripe.mode === "test" && <TestClockPanel />}
        </div>
      )}

      {!loading && !error && !stripe && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Stripe gateway record not found. Please run database migrations.
        </div>
      )}
    </div>
  );
}

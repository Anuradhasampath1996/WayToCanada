"use client";

import * as React from "react";
import {
  CreditCardIcon,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Save,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { adminAuthHeaders } from "@/lib/admin-auth";

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
  webhook_id: string | null;
  updated_at: string;
};

type FormState = {
  mode: "test" | "production";
  is_active: boolean;
  publishable_key: string;
  secret_key: string;
  webhook_id: string;
};

function authHeaders() { return adminAuthHeaders("application/json"); }

function PayPalLogo() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[#003087] font-black text-2xl tracking-tight">Pay</span>
      <span className="text-[#009CDE] font-black text-2xl tracking-tight">Pal</span>
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
    webhook_id: data.webhook_id ?? "",
  });
  const [showPub, setShowPub] = React.useState(false);
  const [showSec, setShowSec] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [toast, setToast] = React.useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [confirmClear, setConfirmClear] = React.useState(false);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSave() {
    setSaving(true);
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
      onSaved();
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : "An error occurred");
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  }

  return (
    <>
      <Card className="relative overflow-hidden">
        {/* Header band */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#009CDE]" />

        <CardHeader className="pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <PayPalLogo />
              <CardDescription>
                Accept PayPal and card payments via PayPal.
              </CardDescription>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {/* Active badge */}
              <Badge
                variant={data.is_active ? "default" : "secondary"}
                className={data.is_active ? "bg-green-600" : ""}
              >
                {data.is_active ? "Active" : "Inactive"}
              </Badge>

              {/* Mode badge */}
              <Badge
                variant="outline"
                className={
                  data.mode === "production"
                    ? "border-orange-400 text-orange-500"
                    : "border-blue-400 text-blue-500"
                }
              >
                {data.mode === "production" ? "🔴 Production" : "🔵 Test"}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Toast */}
          {toast && (
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
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

          {/* Toggle active */}
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Enable Gateway</p>
              <p className="text-muted-foreground text-xs">
                When off, this gateway will not process any payments
              </p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
            />
          </div>

          {/* Mode selector */}
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select
              value={form.mode}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, mode: v as "test" | "production" }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-blue-500 inline-block" />
                    Test Mode — use sandbox keys
                  </span>
                </SelectItem>
                <SelectItem value="production">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-orange-500 inline-block" />
                    Production Mode — live transactions
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {form.mode === "production" && (
              <p className="text-orange-500 text-xs flex items-center gap-1 mt-1">
                <AlertCircle className="size-3" />
                Production mode will charge real money. Double-check your keys.
              </p>
            )}
          </div>

          {/* Client ID */}
          <div className="space-y-1.5">
            <Label>Client ID</Label>
            {data.has_publishable ? (
              <p className="text-muted-foreground text-xs">
                Currently set:{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  {data.publishable_key_preview}
                </code>
                &nbsp;— leave blank to keep existing
              </p>
            ) : (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="size-3" /> No Client ID saved yet
              </p>
            )}
            <div className="relative">
              <Input
                type={showPub ? "text" : "password"}
                placeholder={data.has_publishable ? "Enter new Client ID to replace…" : "AXxx… (Client ID)"}
                value={form.publishable_key}
                onChange={(e) =>
                  setForm((f) => ({ ...f, publishable_key: e.target.value }))
                }
                autoComplete="off"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPub((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPub ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Secret Key */}
          <div className="space-y-1.5">
            <Label>Secret Key</Label>
            {data.has_secret ? (
              <p className="text-muted-foreground text-xs">
                Currently set:{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  {data.secret_key_preview}
                </code>
                &nbsp;— leave blank to keep existing
              </p>
            ) : (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="size-3" /> No Secret Key saved yet
              </p>
            )}
            <div className="relative">
              <Input
                type={showSec ? "text" : "password"}
                placeholder={data.has_secret ? "Enter new Secret Key to replace…" : "EXxx… (Secret)"}
                value={form.secret_key}
                onChange={(e) =>
                  setForm((f) => ({ ...f, secret_key: e.target.value }))
                }
                autoComplete="off"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSec((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSec ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Webhook ID */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Webhook className="size-3.5 text-muted-foreground" />
              Webhook ID
            </Label>
            <p className="text-xs text-muted-foreground">
              Found in PayPal Developer Dashboard → Apps → Your App → Webhooks.
              Required for auto-renewal events (subscription activated, payment received, etc.).
            </p>
            <Input
              type="text"
              placeholder={data.webhook_id ? "Update Webhook ID…" : "WH-XXXX… (Webhook ID)"}
              value={form.webhook_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, webhook_id: e.target.value }))
              }
              autoComplete="off"
            />
            {data.webhook_id && (
              <p className="text-xs text-muted-foreground">
                Currently set:{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  {data.webhook_id.slice(0, 6)}…{data.webhook_id.slice(-4)}
                </code>
              </p>
            )}
            {!data.webhook_id && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="size-3" /> No Webhook ID saved — subscription events will not be verified
              </p>
            )}
          </div>

          {/* Last updated */}
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
          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? (
                <RefreshCw className="size-4 animate-spin mr-2" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              Save Settings
            </Button>

            {(data.has_publishable || data.has_secret) && (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10 border-destructive/40"
                onClick={() => setConfirmClear(true)}
                disabled={clearing}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirm clear dialog */}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear PayPal Keys?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the stored PayPal API keys and
              deactivate the gateway. You will need to re-enter them to use
              PayPal again.
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

  const paypal = gateways.find((g) => g.gateway === "paypal");

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <CreditCardIcon className="size-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            PayPal Payment Gateway
          </h1>
          <p className="text-muted-foreground text-sm">
            Configure PayPal for your platform. Keys are encrypted at rest.
            Switch between test and production modes without losing your keys.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <AlertCircle className="size-4 mt-0.5 shrink-0 text-blue-500" />
        <div>
          <strong>Security note:</strong> Your API keys are encrypted using
          AES-256 before storage. They are never exposed in plain text through
          this interface — only the last 4 characters are shown as a reference.
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <RefreshCw className="size-5 animate-spin" />
          Loading gateway settings…
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={fetchGateways}
          >
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && paypal && (
        <GatewayCard data={paypal} onSaved={fetchGateways} />
      )}

      {!loading && !error && !paypal && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          PayPal gateway record not found in the database. Please run migrations.
        </div>
      )}
    </div>
  );
}

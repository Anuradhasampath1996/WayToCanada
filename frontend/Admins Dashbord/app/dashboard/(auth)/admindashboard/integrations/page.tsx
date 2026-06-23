"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Save, Loader2, Trash2, CheckCircle2, AlertCircle, Mail, KeyRound,
  MessageCircle, Cloud, Video, Brain, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function isTruthySetting(value: string | null | undefined): boolean {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

type IntegrationGroup = {
  key: string;
  label: string;
  description: string;
  fields: string[];
  secrets: string[];
  values: Record<string, string | null>;
  previews: Record<string, string | null>;
  hints?: Record<string, string | null>;
  warnings?: string[];
  configured: boolean;
  source: "database" | "env";
  updated_at: string | null;
};

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  mail: Mail,
  google_oauth: KeyRound,
  google_meet: Video,
  twilio: MessageCircle,
  whatsapp_cloud: MessageCircle,
  zoom: Video,
  microsoft: Video,
  aws_s3: Cloud,
  openai: Brain,
};

const FIELD_LABELS: Record<string, string> = {
  mailer: "Mail driver",
  smtp_host: "SMTP host",
  smtp_port: "SMTP port",
  smtp_encryption: "Encryption (tls / ssl)",
  smtp_username: "SMTP username",
  smtp_password: "SMTP password",
  from_address: "From email",
  from_name: "From name",
  aws_access_key_id: "AWS access key ID",
  aws_secret_access_key: "AWS secret access key",
  aws_region: "AWS region",
  client_id: "Client ID",
  client_secret: "Client secret",
  redirect_uri: "Redirect URI",
  account_sid: "Account SID",
  auth_token: "Auth token",
  whatsapp_from: "WhatsApp sender number",
  provider: "Primary provider (meta or twilio)",
  phone_number_id: "Phone Number ID",
  waba_id: "WhatsApp Business Account ID",
  access_token: "Permanent access token",
  api_version: "Graph API version",
  language: "Template language code",
  consultant_template: "Consultant template name",
  client_template: "Client template name",
  webhook_verify_token: "Webhook verify token",
  app_secret: "Meta App Secret (webhook signature)",
  tenant_id: "Tenant ID",
  access_key_id: "Access key ID",
  secret_access_key: "Secret access key",
  region: "Region",
  bucket: "S3 bucket",
  api_key: "API key",
  enabled: "Legislation Hub AI enabled",
  model: "Legislation model",
  workspace_enabled: "Maple workspace AI (chat & analyze)",
  workspace_model: "Maple model",
};

function SecretField({
  label,
  preview,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  preview: string | null;
  hint?: string | null;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {preview && (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Saved: {preview}
          </span>
          {hint && (
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              starts {hint}
            </span>
          )}
        </span>
      )}
      <Input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={preview ? "Paste new key to replace saved value" : placeholder}
        className="font-mono text-sm"
      />
    </div>
  );
}

function GroupForm({
  group,
  onSaved,
}: {
  group: IntegrationGroup;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const init: Record<string, string> = {};
    group.fields.forEach((f) => {
      if (group.secrets.includes(f)) {
        init[f] = "";
        return;
      }
      if (f === "enabled" || f === "workspace_enabled") {
        const v = group.values[f];
        init[f] = isTruthySetting(v) ? "true" : "false";
        return;
      }
      init[f] = String(group.values[f] ?? "");
    });
    setForm(init);
  }, [group]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/integration-settings/${group.key}`, {
        method: "PUT",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Save failed");
      setMessage(data.message);
      onSaved();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearGroup() {
    await fetch(`${API}/admin/integration-settings/${group.key}`, {
      method: "DELETE",
      headers: adminAuthHeaders(),
    });
    onSaved();
    setMessage("Reverted to .env defaults.");
  }

  async function sendTestMail() {
    if (!testEmail) return;
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/integration-settings/mail/test`, {
        method: "POST",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Test failed");
      setMessage(data.message);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function sendTestOpenAi() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/integration-settings/openai/test`, {
        method: "POST",
        headers: adminAuthHeaders("application/json"),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Test failed");
      setMessage(data.message);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function sendTestWhatsApp() {
    if (!testPhone) return;
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/integration-settings/whatsapp/test`, {
        method: "POST",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify({ to: testPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Test failed");
      setMessage(data.message);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={group.configured ? "default" : "secondary"} className={cn(group.configured && "bg-emerald-600")}>
          {group.configured ? "Configured" : "Not configured"}
        </Badge>
        <Badge variant="outline" className="text-xs">
          Source: {group.source === "database" ? "Admin panel" : ".env file"}
        </Badge>
        {group.updated_at && (
          <span className="text-xs text-muted-foreground">
            Updated {new Date(group.updated_at).toLocaleString("en-CA")}
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{group.description}</p>

      {group.key === "openai" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-medium">Maple AI setup</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-emerald-800">
            <li>Get a key from <strong>platform.openai.com → API keys</strong> (starts with <code className="text-xs">sk-proj-</code> or <code className="text-xs">sk-</code>).</li>
            <li><strong>Paste the full key</strong> in API key below — leaving it blank keeps the old saved key.</li>
            <li>Turn on <strong>Maple workspace AI</strong>, Save, then click <strong>Test OpenAI</strong>.</li>
          </ol>
        </div>
      )}

      {(group.warnings ?? []).length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {group.warnings!.map((w) => (
            <p key={w} className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      {group.key === "whatsapp_cloud" && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 space-y-3">
          <p className="font-medium">Meta WhatsApp Cloud setup</p>
          <ol className="list-decimal space-y-1 pl-4 text-sky-900">
            <li>Create a Meta Business app with WhatsApp product enabled.</li>
            <li>Add approved <strong>Utility</strong> templates in Meta Business Manager:</li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-md border bg-white p-3">
              <p className="font-semibold mb-1">Template: wtc_consultant_alert</p>
              <pre className="whitespace-pre-wrap text-sky-900">{`Hi {{1}},

{{2}}

{{3}}

{{4}}

Please do not reply to this message. Open your consultant dashboard for full details.`}</pre>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="font-semibold mb-1">Template: wtc_client_alert</p>
              <pre className="whitespace-pre-wrap text-sky-900">{`Hi {{1}},

{{2}}

{{3}}

{{4}}

{{5}}

Please do not reply to this message. Contact your consultant directly if you need help.`}</pre>
            </div>
          </div>
          <p className="text-xs text-sky-800">Save Phone Number ID + permanent access token below, then send a test message.</p>
          <div className="rounded-md border bg-white p-3 text-xs">
            <p className="font-semibold mb-1">WhatsApp Inbox webhook (receive messages in admin dashboard)</p>
            <p className="text-sky-900 mb-2">
              In Meta Developer → WhatsApp → Configuration, set Callback URL and Verify Token:
            </p>
            <p className="font-mono break-all rounded bg-sky-50 px-2 py-1">
              {(process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1/webhooks/whatsapp"}
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sky-900">
              <li>Set the same verify token below and in Meta (any random string).</li>
              <li>Add your Meta App Secret below for webhook signature validation.</li>
              <li>Subscribe to <strong>messages</strong> webhook field.</li>
              <li>For local dev, expose your API with ngrok and use the public HTTPS URL.</li>
              <li>Open <strong>WhatsApp Inbox</strong> in the admin sidebar to chat.</li>
            </ol>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {group.fields.map((field) => {
          if (field === "provider") {
            return (
              <div key={field} className="space-y-2 sm:col-span-2">
                <Label>Primary WhatsApp provider</Label>
                <Select value={form.provider || "meta"} onValueChange={(v) => setForm({ ...form, provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">Meta Cloud API (recommended)</SelectItem>
                    <SelectItem value="twilio">Twilio (legacy fallback)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          }

          if (field === "mailer") {
            return (
              <div key={field} className="space-y-2 sm:col-span-2">
                <Label>Mail driver</Label>
                <Select value={form.mailer || "smtp"} onValueChange={(v) => setForm({ ...form, mailer: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smtp">SMTP</SelectItem>
                    <SelectItem value="ses">Amazon SES</SelectItem>
                    <SelectItem value="log">Log (dev)</SelectItem>
                    <SelectItem value="array">Array (dev)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          }

          if (field === "enabled" || field === "workspace_enabled") {
            return (
              <div key={field} className="flex items-center justify-between rounded-lg border p-4 sm:col-span-2">
                <Label>{FIELD_LABELS[field] ?? field}</Label>
                <Switch
                  checked={form[field] === "true" || form[field] === "1"}
                  onCheckedChange={(v) => setForm({ ...form, [field]: v ? "true" : "false" })}
                />
              </div>
            );
          }

          if (group.secrets.includes(field)) {
            return (
              <SecretField
                key={field}
                label={FIELD_LABELS[field] ?? field}
                preview={group.previews[field] ?? null}
                hint={group.hints?.[field] ?? null}
                value={form[field] ?? ""}
                onChange={(v) => setForm({ ...form, [field]: v })}
                placeholder="Enter secret value"
              />
            );
          }

          return (
            <div key={field} className="space-y-2">
              <Label>{FIELD_LABELS[field] ?? field}</Label>
              <Input
                value={form[field] ?? ""}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                placeholder={FIELD_LABELS[field] ?? field}
                className={field.includes("uri") || field.includes("redirect") ? "font-mono text-xs" : ""}
              />
            </div>
          );
        })}
      </div>

      {message && (
        <p className={cn(
          "text-sm rounded-lg px-3 py-2",
          message.includes("failed") || message.includes("Failed") ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800",
        )}>
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-3 pt-2 border-t">
        <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>

        {group.source === "database" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" /> Revert to .env
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revert to .env defaults?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes admin-saved values for {group.label}. The app will use .env file values again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearGroup} className="bg-red-600 hover:bg-red-700">Revert</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {group.key === "mail" && (
          <div className="flex items-center gap-2 ml-auto">
            <Input
              type="email"
              placeholder="test@email.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="h-9 w-48"
            />
            <Button variant="secondary" size="sm" onClick={sendTestMail} disabled={testing || !testEmail}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send test"}
            </Button>
          </div>
        )}

        {group.key === "openai" && (
          <Button variant="secondary" size="sm" className="ml-auto" onClick={sendTestOpenAi} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test OpenAI"}
          </Button>
        )}

        {group.key === "whatsapp_cloud" && (
          <div className="flex items-center gap-2 ml-auto">
            <Input
              placeholder="+14165551234"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="h-9 w-44"
            />
            <Button variant="secondary" size="sm" onClick={sendTestWhatsApp} disabled={testing || !testPhone}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send test"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<IntegrationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(() => searchParams.get("tab") ?? "mail");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/integration-settings`, { headers: adminAuthHeaders() });
      const data = await res.json();
      setGroups(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-emerald-600" />
          Integration credentials
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Manage Google OAuth, SMTP email, WhatsApp, video meetings, AWS, and OpenAI settings.
          Secrets are encrypted in the database. Leave secret fields blank to keep existing values.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Admin panel values override <code className="text-xs bg-amber-100 px-1 rounded">.env</code> at runtime.
          Use &quot;Revert to .env&quot; to remove overrides for a section.
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {groups.map((g) => {
              const Icon = TAB_ICONS[g.key] ?? KeyRound;
              return (
                <TabsTrigger key={g.key} value={g.key} className="gap-1.5 text-xs sm:text-sm">
                  <Icon className="h-3.5 w-3.5" />
                  {g.label.split("(")[0].trim()}
                  {g.configured && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {groups.map((g) => (
            <TabsContent key={g.key} value={g.key} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{g.label}</CardTitle>
                  <CardDescription>{g.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <GroupForm group={g} onSaved={load} />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

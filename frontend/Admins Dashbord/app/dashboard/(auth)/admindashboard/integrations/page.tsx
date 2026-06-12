"use client";

import { useCallback, useEffect, useState } from "react";
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

type IntegrationGroup = {
  key: string;
  label: string;
  description: string;
  fields: string[];
  secrets: string[];
  values: Record<string, string | null>;
  previews: Record<string, string | null>;
  configured: boolean;
  source: "database" | "env";
  updated_at: string | null;
};

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  mail: Mail,
  google_oauth: KeyRound,
  google_meet: Video,
  twilio: MessageCircle,
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
  tenant_id: "Tenant ID",
  access_key_id: "Access key ID",
  secret_access_key: "Secret access key",
  region: "Region",
  bucket: "S3 bucket",
  api_key: "API key",
  enabled: "Enabled",
  model: "Model",
};

function SecretField({
  label,
  preview,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  preview: string | null;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {preview && (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          Saved: {preview}
        </span>
      )}
      <Input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={preview ? "Leave blank to keep current" : placeholder}
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
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const init: Record<string, string> = {};
    group.fields.forEach((f) => {
      if (!group.secrets.includes(f)) {
        init[f] = String(group.values[f] ?? "");
      } else {
        init[f] = "";
      }
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

      <div className="grid gap-4 sm:grid-cols-2">
        {group.fields.map((field) => {
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

          if (field === "enabled") {
            return (
              <div key={field} className="flex items-center justify-between rounded-lg border p-4 sm:col-span-2">
                <Label>OpenAI enabled</Label>
                <Switch
                  checked={form.enabled === "true" || form.enabled === "1"}
                  onCheckedChange={(v) => setForm({ ...form, enabled: v ? "true" : "false" })}
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
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [groups, setGroups] = useState<IntegrationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("mail");

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

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  CalendarDays,
  Send,
  Trash2,
  Loader2,
  AlertCircle,
  UserCircle2,
  Pencil,
  Check,
  X,
  MessageCircle,
  ShieldCheck,
  ArrowRight,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ClientActivityReport } from "./client-activity-report";
import { ClientTrustLedgerPanel } from "./client-trust-ledger-panel";
import { ClientCommandCenter } from "./client-command-center";
import { ClientCompliancePacketExport } from "./client-compliance-packet-export";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

const PATHWAY_COLORS: Record<string, string> = {
  "Express Entry": "bg-blue-500/10 text-blue-700 border-blue-200/60",
  PNP: "bg-violet-500/10 text-violet-700 border-violet-200/60",
  "Family Sponsorship": "bg-pink-500/10 text-pink-700 border-pink-200/60",
  "Study Permit": "bg-amber-500/10 text-amber-700 border-amber-200/60",
  "Work Permit": "bg-emerald-500/10 text-emerald-700 border-emerald-200/60",
  Refugee: "bg-red-500/10 text-red-700 border-red-200/60",
};

interface ClientData {
  id: number;
  user_id: number;
  phone: string | null;
  passport_number: string | null;
  immigration_pathway: string | null;
  family_id: number | null;
  notes: string | null;
  notes_updated_at: string | null;
  invited_at: string | null;
  created_at: string;
  user: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    is_verified: boolean;
    email_verified_at: string | null;
    created_at: string;
  };
}

function authHeaders(json = true) {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function clientPhone(client: ClientData): string | null {
  return client.user.phone ?? client.phone;
}

function toWhatsAppUrl(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = `1${digits}`;
  return `https://wa.me/${digits}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function EmailLink({ email, className }: { email: string; className?: string }) {
  return (
    <a
      href={`mailto:${email}`}
      className={cn(
        "inline-flex max-w-full items-center gap-2 truncate text-sm font-medium text-primary underline-offset-4 hover:underline",
        className,
      )}
      title={`Email ${email}`}
    >
      <Mail className="size-4 shrink-0 opacity-70" />
      <span className="truncate">{email}</span>
    </a>
  );
}

function PhoneLink({ phone, className }: { phone: string; className?: string }) {
  return (
    <a
      href={toWhatsAppUrl(phone)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 text-sm font-medium text-emerald-700 underline-offset-4 hover:text-emerald-800 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300",
        className,
      )}
      title={`Open WhatsApp chat with ${phone}`}
    >
      <MessageCircle className="size-4 shrink-0" />
      <span>{phone}</span>
    </a>
  );
}

function DetailItem({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/10 px-4 py-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

interface Toast {
  id: number;
  msg: string;
  type: "success" | "error";
}

export function ClientProfilePageClient({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);
  const router = useRouter();

  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [resending, setResending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassport, setEditPassport] = useState("");
  const [editPathway, setEditPathway] = useState("");
  const [editFamilyId, setEditFamilyId] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const addToast = (msg: string, type: "success" | "error" = "success") => {
    const toastId = Date.now();
    setToasts((t) => [...t, { id: toastId, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toastId)), 3500);
  };

  useEffect(() => {
    fetch(`${API}/consultant/clients/${id}`, { headers: authHeaders(false) })
      .then((r) => {
        if (r.status === 403) throw new Error("forbidden");
        if (r.status === 404) throw new Error("not_found");
        if (!r.ok) throw new Error("error");
        return r.json();
      })
      .then((json) => setClient(json.client))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash === "#tab-money") setActiveTab("money");
    if (hash === "#tab-activity") setActiveTab("activity");
    if (hash === "#tab-settings") setActiveTab("settings");
  }, []);

  const startEdit = () => {
    if (!client) return;
    setEditName(client.user.name);
    setEditPhone(clientPhone(client) ?? "");
    setEditPassport(client.passport_number ?? "");
    setEditPathway(client.immigration_pathway ?? "");
    setEditFamilyId(client.family_id ? String(client.family_id) : "");
    setEditNotes(client.notes ?? "");
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!client) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/consultant/clients/${client.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          name: editName.trim() || undefined,
          phone: editPhone.trim() || null,
          passport_number: editPassport.trim() || null,
          immigration_pathway: editPathway || null,
          family_id: editFamilyId ? Number(editFamilyId) : null,
          notes: editNotes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Update failed.");
      setClient(json.client);
      setEditing(false);
      addToast("Profile updated.");
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Update failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const startNotesEdit = () => {
    if (!client) return;
    setNotesValue(client.notes ?? "");
    setEditingNotes(true);
  };

  const cancelNotesEdit = () => setEditingNotes(false);

  const saveNotes = async () => {
    if (!client) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`${API}/consultant/clients/${client.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ notes: notesValue.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Save failed.");
      setClient(json.client);
      setEditingNotes(false);
      addToast("Notes saved.");
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setSavingNotes(false);
    }
  };

  const resendInvite = async () => {
    if (!client) return;
    setResending(true);
    try {
      const res = await fetch(`${API}/consultant/clients/${client.id}/resend-invite`, {
        method: "POST",
        headers: authHeaders(false),
      });
      if (!res.ok) throw new Error("Failed to resend.");
      addToast("Invitation email sent.");
    } catch {
      addToast("Failed to send invite.", "error");
    } finally {
      setResending(false);
    }
  };

  const removeClient = async () => {
    if (!client) return;
    try {
      const res = await fetch(`${API}/consultant/clients/${client.id}`, {
        method: "DELETE",
        headers: authHeaders(false),
      });
      if (!res.ok) throw new Error("Delete failed.");
      router.push("/dashboard/clients");
    } catch {
      addToast("Failed to remove client.", "error");
      setDeleting(false);
    }
  };

  const toggleStatus = async () => {
    if (!client) return;
    setToggling(true);
    try {
      const res = await fetch(`${API}/consultant/clients/${client.id}/toggle-status`, {
        method: "PATCH",
        headers: authHeaders(false),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to update status.");
      setClient((c) => (c ? { ...c, user: { ...c.user, is_verified: json.is_verified } } : c));
      addToast(json.message);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Failed to update status.", "error");
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-40 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        Loading client profile…
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-40 text-center">
        <AlertCircle className="size-10 text-destructive/70" />
        <p className="text-lg font-semibold">
          {error === "not_found"
            ? "Client not found."
            : error === "forbidden"
              ? "Access denied."
              : "Failed to load client."}
        </p>
        <Button variant="outline" asChild className="rounded-xl">
          <Link href="/dashboard/clients">
            <ArrowLeft className="mr-2 size-4" />
            Back to clients
          </Link>
        </Button>
      </div>
    );
  }

  const phone = clientPhone(client);
  const workspaceHref = `/dashboard/clients/${client.id}/workspace`;

  return (
    <div className="min-w-0 w-full space-y-4 pb-4 sm:space-y-5 sm:pb-6">
      <div className="fixed top-4 right-3 left-3 z-50 flex flex-col gap-2 pointer-events-none sm:left-auto sm:max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm",
              t.type === "success"
                ? "border-emerald-200/80 bg-background text-emerald-800"
                : "border-red-200/80 bg-background text-red-700",
            )}
          >
            {t.type === "success" ? (
              <Check className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            {t.msg}
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5 md:p-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4 h-8 px-2 text-muted-foreground">
          <Link href="/dashboard/clients">
            <ArrowLeft className="mr-1.5 size-4" />
            All clients
          </Link>
        </Button>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
              {initials(client.user.name) || <UserCircle2 className="size-7" />}
            </div>
            <div className="min-w-0 space-y-2">
              <h1 className="text-xl font-bold tracking-tight break-words sm:text-2xl md:text-3xl">{client.user.name}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <EmailLink email={client.user.email} className="text-muted-foreground hover:text-primary" />
                {phone ? (
                  <>
                    <span className="hidden sm:inline">·</span>
                    <PhoneLink phone={phone} />
                  </>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {client.immigration_pathway && (
                  <Badge
                    variant="outline"
                    className={cn("text-xs", PATHWAY_COLORS[client.immigration_pathway] ?? "bg-muted")}
                  >
                    {client.immigration_pathway}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    client.user.is_verified
                      ? "border-emerald-200/60 bg-emerald-500/10 text-emerald-700"
                      : "border-amber-200/60 bg-amber-500/10 text-amber-800",
                  )}
                >
                  {client.user.is_verified ? "Portal active" : "Portal inactive"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row lg:w-auto lg:flex-col">
            <Button size="lg" className="h-11 w-full rounded-xl px-6 sm:w-auto" asChild>
              <Link href={workspaceHref}>
                <Briefcase className="mr-2 size-4" />
                Open case workspace
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={resendInvite} disabled={resending}>
                {resending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="mr-1.5 size-3.5" />}
                Resend invite
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setActiveTab("settings");
                  startEdit();
                }}
              >
                <Pencil className="mr-1.5 size-3.5" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto p-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:w-auto [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="overview" className="shrink-0 rounded-lg px-3 py-2 text-xs sm:px-4 sm:text-sm">
            Case overview
          </TabsTrigger>
          <TabsTrigger value="money" className="shrink-0 rounded-lg px-3 py-2 text-xs sm:px-4 sm:text-sm" id="tab-money">
            Trust &amp; compliance
          </TabsTrigger>
          <TabsTrigger value="activity" className="shrink-0 rounded-lg px-3 py-2 text-xs sm:px-4 sm:text-sm">
            Activity log
          </TabsTrigger>
          <TabsTrigger value="settings" className="shrink-0 rounded-lg px-3 py-2 text-xs sm:px-4 sm:text-sm">
            Client settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <ClientCommandCenter clientId={client.id} onNavigateTab={setActiveTab} />
        </TabsContent>

        <TabsContent value="money" className="mt-4 space-y-4">
          <ClientCompliancePacketExport clientId={client.id} />
          <div id="client-trust-ledger">
            <ClientTrustLedgerPanel clientId={client.id} />
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ClientActivityReport clientId={client.id} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4 space-y-4">
          {editing && (
            <Card className="border-primary/30 bg-primary/[0.03] shadow-sm">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Edit client profile</CardTitle>
                  <Button variant="ghost" size="icon" className="size-8" onClick={cancelEdit}>
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Full name</Label>
                    <Input id="edit-name" className="rounded-xl bg-background" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      className="rounded-xl bg-background"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-passport">Passport number</Label>
                    <Input
                      id="edit-passport"
                      className="rounded-xl bg-background"
                      value={editPassport}
                      onChange={(e) => setEditPassport(e.target.value)}
                      placeholder="e.g. AB1234567"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={cancelEdit}>
                    Cancel
                  </Button>
                  <Button size="sm" className="rounded-xl" onClick={saveEdit} disabled={saving}>
                    {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Check className="mr-1.5 size-3.5" />}
                    Save changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="text-base">Portal access</CardTitle>
                <CardDescription>Control whether this client can sign in to their portal.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {client.user.is_verified ? "Client can access portal" : "Portal access disabled"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {client.user.email_verified_at
                      ? `Email verified ${formatDate(client.user.email_verified_at)}`
                      : "Email not verified yet"}
                  </p>
                </div>
                <Switch
                  checked={client.user.is_verified}
                  onCheckedChange={toggleStatus}
                  disabled={toggling}
                  aria-label="Toggle portal access"
                />
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="text-base">Account details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
                <DetailItem icon={CalendarDays} label="Member since">
                  <span className="text-sm font-medium">{formatDate(client.created_at)}</span>
                </DetailItem>
                <DetailItem icon={Send} label="Invite sent">
                  <span className="text-sm font-medium">{formatDate(client.invited_at)}</span>
                </DetailItem>
                <DetailItem icon={ShieldCheck} label="Email">
                  <EmailLink email={client.user.email} />
                </DetailItem>
                <DetailItem icon={Phone} label="Phone">
                  {phone ? <PhoneLink phone={phone} /> : <span className="text-sm text-muted-foreground">—</span>}
                </DetailItem>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/50 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Private notes</CardTitle>
                  <CardDescription>Only you can see these — not shared with the client.</CardDescription>
                </div>
                {!editingNotes && (
                  <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={startNotesEdit}>
                    <Pencil className="mr-1.5 size-3.5" />
                    {client.notes ? "Edit" : "Add note"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {editingNotes ? (
                <div className="space-y-3">
                  <Textarea
                    rows={6}
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder="Write private notes about this client…"
                    className="min-h-[140px] resize-y rounded-xl bg-muted/15 text-sm"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={cancelNotesEdit} disabled={savingNotes}>
                      Cancel
                    </Button>
                    <Button size="sm" className="rounded-xl" onClick={saveNotes} disabled={savingNotes}>
                      {savingNotes ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : "Save note"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {client.notes ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{client.notes}</p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">No notes yet.</p>
                  )}
                  {client.notes_updated_at && (
                    <p className="text-xs text-muted-foreground">
                      Updated{" "}
                      {new Date(client.notes_updated_at).toLocaleString("en-CA", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-red-200/60 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-800">Remove client</p>
                <p className="text-xs text-muted-foreground">Permanently deletes this client and all case data.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full rounded-xl border-red-200 text-red-700 hover:bg-red-50 sm:w-auto"
                onClick={() => setDeleting(true)}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Remove client
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{client.user.name}</strong>&apos;s account and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeClient} className="bg-destructive text-white hover:bg-destructive/90">
              Remove client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

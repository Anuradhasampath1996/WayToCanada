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
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

const PATHWAYS = [
  "Express Entry",
  "PNP",
  "Family Sponsorship",
  "Study Permit",
  "Work Permit",
  "Refugee",
  "Super Visa",
  "Visitor Visa",
  "Citizenship Application",
  "Other",
];

const PATHWAY_COLORS: Record<string, string> = {
  "Express Entry":       "bg-blue-100 text-blue-700 border-blue-200",
  "PNP":                 "bg-purple-100 text-purple-700 border-purple-200",
  "Family Sponsorship":  "bg-pink-100 text-pink-700 border-pink-200",
  "Study Permit":        "bg-amber-100 text-amber-700 border-amber-200",
  "Work Permit":         "bg-green-100 text-green-700 border-green-200",
  "Refugee":             "bg-red-100 text-red-700 border-red-200",
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
    "Accept": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium break-all">{value ?? <span className="text-muted-foreground font-normal">—</span>}</p>
      </div>
    </div>
  );
}

interface Toast { id: number; msg: string; type: "success" | "error" }

export function ClientProfilePageClient({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);
  const router  = useRouter();

  const [client,    setClient]    = useState<ClientData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [toasts,    setToasts]    = useState<Toast[]>([]);
  const [resending,    setResending]    = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [editing,      setEditing]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [toggling,     setToggling]     = useState(false);

  // Inline notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue,   setNotesValue]   = useState("");
  const [savingNotes,  setSavingNotes]  = useState(false);

  // Edit form state
  const [editName,     setEditName]     = useState("");
  const [editPhone,    setEditPhone]    = useState("");
  const [editPassport, setEditPassport] = useState("");
  const [editPathway,  setEditPathway]  = useState("");
  const [editFamilyId, setEditFamilyId] = useState("");
  const [editNotes,    setEditNotes]    = useState("");

  const addToast = (msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };

  useEffect(() => {
    fetch(`${API}/consultant/clients/${id}`, { headers: authHeaders(false) })
      .then(r => {
        if (r.status === 403) throw new Error("forbidden");
        if (r.status === 404) throw new Error("not_found");
        if (!r.ok) throw new Error("error");
        return r.json();
      })
      .then(json => setClient(json.client))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const startEdit = () => {
    if (!client) return;
    setEditName(client.user.name);
    setEditPhone(client.user.phone ?? client.phone ?? "");
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
          name:                editName.trim() || undefined,
          phone:               editPhone.trim() || null,
          passport_number:     editPassport.trim() || null,
          immigration_pathway: editPathway || null,
          family_id:           editFamilyId ? Number(editFamilyId) : null,
          notes:               editNotes.trim() || null,
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
      setClient(c => c ? { ...c, user: { ...c.user, is_verified: json.is_verified } } : c);
      addToast(json.message);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Failed to update status.", "error");
    } finally {
      setToggling(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error ──
  if (error || !client) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center gap-4">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-lg font-semibold">
          {error === "not_found" ? "Client not found." : error === "forbidden" ? "Access denied." : "Failed to load client."}
        </p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/clients"><ArrowLeft className="mr-2 h-4 w-4" />Back to My Clients</Link>
        </Button>
      </div>
    );
  }

  const initials = client.user.name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Toast stack */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg transition-all",
            t.type === "success" ? "bg-white border-green-200 text-green-800" : "bg-white border-red-200 text-red-700"
          )}>
            {t.type === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            {t.msg}
          </div>
        ))}
      </div>

      {/* Back */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/clients">
            <ArrowLeft className="mr-1.5 h-4 w-4" />Back to My Clients
          </Link>
        </Button>
      </div>

      {/* Header card */}
      <div className="rounded-xl border p-6 mb-6">
        {/* Top row: avatar + name/email + status toggle */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary font-bold text-xl flex items-center justify-center shrink-0">
              {initials || <UserCircle2 className="h-7 w-7" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{client.user.name}</h1>
              <p className="text-sm text-muted-foreground truncate">{client.user.email}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {client.immigration_pathway && (
                  <Badge variant="outline" className={cn("text-xs", PATHWAY_COLORS[client.immigration_pathway])}>
                    {client.immigration_pathway}
                  </Badge>
                )}
                {client.user.is_verified ? (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Active</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">Inactive</Badge>
                )}
                {client.user.email_verified_at ? (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Email Verified</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Email not verified</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Active / Inactive toggle */}
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shrink-0">
            <span className={cn("text-xs font-medium", client.user.is_verified ? "text-green-700" : "text-red-600")}>
              {client.user.is_verified ? "Active" : "Inactive"}
            </span>
            <Switch
              checked={client.user.is_verified}
              onCheckedChange={toggleStatus}
              disabled={toggling}
              aria-label="Toggle client active status"
            />
          </div>
        </div>

        {/* Bottom row: action buttons */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={resendInvite} disabled={resending}>
            {resending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
            Resend Invite
          </Button>
          <Button variant="outline" size="sm" onClick={startEdit} disabled={editing}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit Profile
          </Button>
          <Button asChild size="sm" className="bg-primary">
            <Link href={`/dashboard/clients/${client.id}/workspace`}>
              <Briefcase className="mr-1.5 h-3.5 w-3.5" />Go to Workspace
            </Link>
          </Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => setDeleting(true)}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove Client
          </Button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 mb-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">Edit Client Profile</p>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-passport">Passport Number</Label>
              <Input id="edit-passport" value={editPassport} onChange={e => setEditPassport(e.target.value)} placeholder="e.g. AB1234567" />
            </div>

          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Private Notes</Label>
            <Textarea id="edit-notes" rows={3} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={cancelEdit}>Cancel</Button>
            <Button size="sm" onClick={saveEdit} disabled={saving}>
              {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</> : <><Check className="mr-1.5 h-3.5 w-3.5" />Save Changes</>}
            </Button>
          </div>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Contact */}
        <div className="rounded-xl border p-5 flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Contact Details</p>
          <div className="flex-1">
            <InfoRow icon={Mail}  label="Email"  value={client.user.email} />
            <InfoRow icon={Phone} label="Phone"  value={client.user.phone ?? client.phone} />
            <InfoRow icon={CalendarDays} label="Member Since" value={formatDate(client.created_at)} />
            <InfoRow icon={Send}         label="Invite Sent"  value={formatDate(client.invited_at)} />
          </div>
        </div>

        {/* Private Notes */}
        <div className="rounded-xl border p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Private Notes</p>
            {!editingNotes && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={startNotesEdit}>
                <Pencil className="h-3 w-3 mr-1" />{client.notes ? "Edit" : "Add Note"}
              </Button>
            )}
          </div>

          {editingNotes ? (
            <div className="flex flex-col gap-2 flex-1">
              <Textarea
                rows={6}
                value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                placeholder="Write private notes about this client…"
                className="resize-none text-sm"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={cancelNotesEdit} disabled={savingNotes}>
                  <X className="h-3.5 w-3.5 mr-1" />Cancel
                </Button>
                <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                  {savingNotes
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Saving…</>
                    : <><Check className="h-3.5 w-3.5 mr-1" />Save</>}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-2">
              {client.notes ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{client.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No notes added yet. Click &ldquo;Add Note&rdquo; to get started.</p>
              )}
              {client.notes_updated_at && (
                <p className="text-xs text-muted-foreground mt-auto pt-2 border-t">
                  Last updated {new Date(client.notes_updated_at).toLocaleString("en-CA", {
                    year: "numeric", month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm dialog */}
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Client</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{client.user.name}</strong>&apos;s account and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeClient} className="bg-destructive text-white hover:bg-destructive/90">
              Remove Client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

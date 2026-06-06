"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Mail,
  MailCheck,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

interface FormState {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

interface FieldErrors {
  [key: string]: string[];
}

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function FieldError({ errors, field }: { errors: FieldErrors; field: string }) {
  const msgs = errors[field];
  if (!msgs?.length) return null;
  return <p className="text-xs text-red-600 mt-1">{msgs[0]}</p>;
}

export function AddClientPageClient() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const [status,      setStatus]     = useState<"idle" | "loading" | "success" | "error">("idle");
  const [fieldErrors,  setFieldErrors] = useState<FieldErrors>({});
  const [errorMsg,     setErrorMsg]   = useState("");
  const [sendInvite,   setSendInvite] = useState(true);
  const [inviteSent,   setInviteSent] = useState(false);

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setFieldErrors({});
    setErrorMsg("");

    const payload: Record<string, unknown> = {
      name:        form.name.trim(),
      email:       form.email.trim(),
      phone:       form.phone.trim() || null,
      notes:       form.notes.trim() || null,
      send_invite: sendInvite,
    };

    try {
      const res  = await fetch(`${API}/consultant/clients`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (res.status === 422) {
        setFieldErrors(json.errors ?? {});
        setStatus("error");
        return;
      }
      if (!res.ok) {
        throw new Error(json?.message ?? "Failed to create client.");
      }

      setInviteSent(sendInvite);
      setStatus("success");
      // Redirect to client list after short delay
      setTimeout(() => router.push("/dashboard/clients"), 3000);

    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <CheckCircle2 className="h-14 w-14 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Client Added!</h2>
        {inviteSent ? (
          <p className="text-muted-foreground mb-6 max-w-sm">
            The account has been created and an invitation email with login credentials has been sent to the client.
          </p>
        ) : (
          <div className="max-w-sm mb-6 space-y-2">
            <p className="text-muted-foreground">
              The account has been created. No invitation email was sent yet.
            </p>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              You can send the invite later from the client list using &ldquo;Resend Invite&rdquo;.
            </p>
          </div>
        )}
        <p className="text-sm text-muted-foreground">Redirecting to your client list…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* Back */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/clients">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to My Clients
          </Link>
        </Button>
      </div>

      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-primary" />
          Add New Client
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Fill in the client's details below. A secure password will be auto-generated and sent to their email.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 mb-8">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          A secure login password will be auto-generated. You can choose to send the invitation email now or later from the client list.
        </span>
      </div>

      {/* Global error */}
      {status === "error" && errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-6">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Personal Info ── */}
        <fieldset className="rounded-xl border p-6 space-y-4">
          <legend className="text-sm font-semibold px-1 text-muted-foreground uppercase tracking-wide">
            Personal Information
          </legend>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Jane Doe"
              value={form.name}
              onChange={set("name")}
              className={cn(fieldErrors.name && "border-red-400")}
              required
            />
            <FieldError errors={fieldErrors} field="name" />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="client@example.com"
              value={form.email}
              onChange={set("email")}
              className={cn(fieldErrors.email && "border-red-400")}
              required
            />
            <FieldError errors={fieldErrors} field="email" />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={form.phone}
              onChange={set("phone")}
              className={cn(fieldErrors.phone && "border-red-400")}
            />
            <FieldError errors={fieldErrors} field="phone" />
          </div>
        </fieldset>

        {/* ── Notes ── */}
        <fieldset className="rounded-xl border p-6 space-y-4">
          <legend className="text-sm font-semibold px-1 text-muted-foreground uppercase tracking-wide">
            Notes
          </legend>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Private Consultant Notes</Label>
            <Textarea
              id="notes"
              rows={4}
              placeholder="Any private notes about this client's case (not visible to the client)…"
              value={form.notes}
              onChange={set("notes")}
              className={cn(fieldErrors.notes && "border-red-400")}
            />
            <FieldError errors={fieldErrors} field="notes" />
          </div>
        </fieldset>

        {/* ── Send Invite Toggle ── */}
        <fieldset className={cn(
          "rounded-xl border p-5 transition-colors",
          sendInvite ? "border-primary/40 bg-primary/5" : "border-dashed"
        )}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {sendInvite ? (
                <MailCheck className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <div>
                <p className="font-medium text-sm leading-none mb-1">
                  {sendInvite ? "Send invitation email now" : "Send invitation email later"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sendInvite
                    ? "Client will receive their login credentials immediately after account creation."
                    : "Account will be created but no email is sent. Use \u201cResend Invite\u201d from the client list when ready."}
                </p>
              </div>
            </div>
            <Switch
              checked={sendInvite}
              onCheckedChange={setSendInvite}
              aria-label="Send invitation email"
            />
          </div>
        </fieldset>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/clients">Cancel</Link>
          </Button>
          <Button type="submit" disabled={status === "loading"} className="min-w-36">
            {status === "loading" ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
            ) : sendInvite ? (
              <><Mail className="mr-2 h-4 w-4" /> Create Now</>
            ) : (
              <><UserPlus className="mr-2 h-4 w-4" /> Create Account</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

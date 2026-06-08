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
  Mail,
  MailCheck,
  Clock,
  User,
  Phone,
  StickyNote,
  Sparkles,
  Shield,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function FieldError({ errors, field }: { errors: FieldErrors; field: string }) {
  const msgs = errors[field];
  if (!msgs?.length) return null;
  return <p className="text-xs text-destructive mt-1.5">{msgs[0]}</p>;
}

function SectionIcon({ icon: Icon, className }: { icon: typeof User; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary",
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export function AddClientPageClient() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [inviteSent, setInviteSent] = useState(false);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setFieldErrors({});
    setErrorMsg("");

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
      send_invite: sendInvite,
    };

    try {
      const res = await fetch(`${API}/consultant/clients`, {
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
      setTimeout(() => router.push("/dashboard/clients"), 3000);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="flex min-h-[min(70vh,640px)] w-full items-center justify-center py-16">
        <Card className="w-full max-w-xl border-emerald-200/60 bg-gradient-to-br from-background to-emerald-500/[0.04] shadow-lg">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="size-8" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight">Client added successfully</h2>
            {inviteSent ? (
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                The account has been created and an invitation email with login credentials was sent to the client.
              </p>
            ) : (
              <div className="mt-2 max-w-md space-y-2">
                <p className="text-sm text-muted-foreground">
                  The account has been created. No invitation email was sent yet.
                </p>
                <p className="rounded-xl border border-amber-200/80 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                  Send the invite later from the client list using &ldquo;Resend Invite&rdquo;.
                </p>
              </div>
            )}
            <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Redirecting to your client list…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-10">
      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 px-2 text-muted-foreground">
              <Link href="/dashboard/clients">
                <ArrowLeft className="mr-1.5 size-4" />
                Back to clients
              </Link>
            </Button>
            <div className="space-y-1">
              <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight md:text-3xl">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserPlus className="size-5" />
                </span>
                Add new client
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Create a client profile, auto-generate secure credentials, and optionally send their portal invite right away.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
            {[
              { step: "1", label: "Contact details" },
              { step: "2", label: "Private notes" },
              { step: "3", label: "Send invite" },
            ].map((item) => (
              <Badge
                key={item.step}
                variant="outline"
                className="h-7 gap-1.5 rounded-lg border-border/70 bg-background/80 px-2.5 text-[11px] font-medium"
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {item.step}
                </span>
                {item.label}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {status === "error" && errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid w-full gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-start gap-3">
                  <SectionIcon icon={User} />
                  <div>
                    <CardTitle className="text-base">Contact information</CardTitle>
                    <CardDescription className="mt-1">
                      Basic details used for the client portal account and communication.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Full name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="Jane Doe"
                      value={form.name}
                      onChange={set("name")}
                      className={cn("h-10 rounded-xl bg-muted/20", fieldErrors.name && "border-destructive")}
                      required
                    />
                    <FieldError errors={fieldErrors} field="name" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Email address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="client@example.com"
                      value={form.email}
                      onChange={set("email")}
                      className={cn("h-10 rounded-xl bg-muted/20", fieldErrors.email && "border-destructive")}
                      required
                    />
                    <FieldError errors={fieldErrors} field="email" />
                  </div>
                </div>

                <div className="space-y-2 md:max-w-md">
                  <Label htmlFor="phone" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Phone number
                  </Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={form.phone}
                      onChange={set("phone")}
                      className={cn("h-10 rounded-xl bg-muted/20 pl-9", fieldErrors.phone && "border-destructive")}
                    />
                  </div>
                  <FieldError errors={fieldErrors} field="phone" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-start gap-3">
                  <SectionIcon icon={StickyNote} />
                  <div>
                    <CardTitle className="text-base">Consultant notes</CardTitle>
                    <CardDescription className="mt-1">
                      Private notes for your practice — not visible to the client.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Case notes
                  </Label>
                  <Textarea
                    id="notes"
                    rows={5}
                    placeholder="Immigration pathway, family details, intake context, or follow-up reminders…"
                    value={form.notes}
                    onChange={set("notes")}
                    className={cn("min-h-[140px] resize-y rounded-xl bg-muted/20", fieldErrors.notes && "border-destructive")}
                  />
                  <FieldError errors={fieldErrors} field="notes" />
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <Card
              className={cn(
                "border-border/70 shadow-sm transition-colors",
                sendInvite ? "border-primary/30 bg-primary/[0.03]" : "",
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <SectionIcon
                    icon={sendInvite ? MailCheck : Clock}
                    className={sendInvite ? "bg-primary/15" : "bg-muted text-muted-foreground"}
                  />
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">Portal invitation</CardTitle>
                    <CardDescription className="mt-1">
                      {sendInvite
                        ? "Credentials will be emailed immediately after creation."
                        : "Create the account now and send the invite when you are ready."}
                    </CardDescription>
                  </div>
                  <Switch checked={sendInvite} onCheckedChange={setSendInvite} aria-label="Send invitation email" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Shield className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span>A secure password is auto-generated. You never need to choose or share one manually.</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <CardTitle className="text-sm">What happens next</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {[
                  "Client profile is added to your practice",
                  sendInvite ? "Invite email with login link is sent" : "Invite can be sent later from client list",
                  "Client appears on your Application Progress Board after retainer signing",
                ].map((text, i) => (
                  <div key={text} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <span>{text}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardContent className="flex flex-col gap-2.5 p-4">
                <Button type="submit" disabled={status === "loading"} className="h-10 w-full rounded-xl">
                  {status === "loading" ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Creating client…
                    </>
                  ) : sendInvite ? (
                    <>
                      <Mail className="mr-2 size-4" />
                      Create &amp; send invite
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 size-4" />
                      Create account
                      <ArrowRight className="ml-auto size-4 opacity-70" />
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" asChild className="h-10 w-full rounded-xl">
                  <Link href="/dashboard/clients">Cancel</Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </form>
    </div>
  );
}

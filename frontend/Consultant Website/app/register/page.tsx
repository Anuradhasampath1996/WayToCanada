"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, CheckCircle, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface FieldErrors {
  first_name?: string[];
  last_name?: string[];
  email?: string[];
  phone?: string[];
  password?: string[];
  password_confirmation?: string[];
}

const BENEFITS = [
  "Free to join — no monthly fees to start",
  "Access to a pool of pre-qualified applicants",
  "Built-in case management and document tools",
  "CICC-compliant audit trail and compliance tools",
  "Get paid securely through the platform",
];

export default function RegisterPage() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    password_confirmation: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState("");
  const [done, setDone] = useState(false);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      setGeneralError("");
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/register/consultant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 422 && data?.errors) {
          setFieldErrors(data.errors);
        } else {
          setGeneralError(data?.message ?? "Registration failed. Please try again.");
        }
        return;
      }
      localStorage.setItem("wtc_token", data.token);
      localStorage.setItem("wtc_user", JSON.stringify(data.user));
      setDone(true);
    } catch {
      setGeneralError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setGeneralError("");
    try {
      const res = await fetch(`${API}/auth/google/consultant/redirect`, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json();
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        setGeneralError("Could not initiate Google sign-up. Please try again.");
        setGoogleLoading(false);
      }
    } catch {
      setGeneralError("Network error. Please try again.");
      setGoogleLoading(false);
    }
  }

  // ── Success / check-email screen ────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
        <div className="w-full max-w-md bg-background rounded-2xl shadow-lg p-10 text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MailCheck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Check your inbox</h1>
            <p className="text-sm text-muted-foreground">
              We sent a verification link to{" "}
              <span className="font-medium text-foreground">{form.email}</span>.
              Click the link to activate your account.
            </p>
          </div>
          <div className="rounded-md bg-muted px-4 py-3 text-xs text-muted-foreground text-left space-y-1">
            <p>• Check your spam folder if you don&apos;t see it within a few minutes.</p>
            <p>• The link expires in 60 minutes.</p>
          </div>
          <ResendButton email={form.email} />
          <p className="text-sm text-muted-foreground">
            Already verified?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Registration form ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 text-primary-foreground">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Briefcase className="h-6 w-6" />
          <span>WayToCanada</span>
          <Badge variant="secondary" className="text-xs text-primary ml-1">Consultants</Badge>
        </Link>
        <div className="space-y-6">
          <h2 className="text-3xl font-extrabold leading-snug">
            Join Canada&apos;s Fastest-Growing Consultant Platform
          </h2>
          <p className="text-sm text-primary-foreground/80">
            Thousands of RCICs are already growing their practices on WayToCanada.
          </p>
          <ul className="space-y-3 text-sm text-primary-foreground/90">
            {BENEFITS.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} WayToCanada Consultant Portal.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-lg space-y-7">

          {/* Mobile logo */}
          <Link href="/" className="flex lg:hidden items-center gap-2 font-bold text-xl text-primary justify-center">
            <Briefcase className="h-6 w-6" />
            <span>WayToCanada</span>
          </Link>

          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Consultant Portal</p>
            <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Register as a consultant — we&apos;ll send a verification email to get you started.
            </p>
          </div>

          {generalError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {generalError}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" type="text" autoComplete="given-name" required placeholder="Jane"
                  value={form.first_name} onChange={set("first_name")} aria-invalid={!!fieldErrors.first_name} />
                {fieldErrors.first_name && <p className="text-xs text-destructive">{fieldErrors.first_name[0]}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" type="text" autoComplete="family-name" required placeholder="Doe"
                  value={form.last_name} onChange={set("last_name")} aria-invalid={!!fieldErrors.last_name} />
                {fieldErrors.last_name && <p className="text-xs text-destructive">{fieldErrors.last_name[0]}</p>}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" autoComplete="email" required placeholder="jane.doe@example.com"
                value={form.email} onChange={set("email")} aria-invalid={!!fieldErrors.email} />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" autoComplete="tel" required placeholder="+1 (416) 555-0100"
                value={form.phone} onChange={set("phone")} aria-invalid={!!fieldErrors.phone} />
              {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone[0]}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password"
                  required placeholder="Min. 8 chars, letters & numbers" value={form.password}
                  onChange={set("password")} aria-invalid={!!fieldErrors.password} className="pr-10" />
                <button type="button" tabIndex={-1} aria-label="Toggle password"
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password[0]}</p>}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label htmlFor="password_confirmation">Confirm Password</Label>
              <div className="relative">
                <Input id="password_confirmation" type={showConfirm ? "text" : "password"} autoComplete="new-password"
                  required placeholder="••••••••" value={form.password_confirmation}
                  onChange={set("password_confirmation")} aria-invalid={!!fieldErrors.password_confirmation} className="pr-10" />
                <button type="button" tabIndex={-1} aria-label="Toggle confirm password"
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm((v) => !v)}>
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password_confirmation && <p className="text-xs text-destructive">{fieldErrors.password_confirmation[0]}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account…</> : "Create Account"}
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or sign up with</span>
            <Separator className="flex-1" />
          </div>

          <Button variant="outline" type="button" className="w-full gap-2" onClick={handleGoogle} disabled={googleLoading}>
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Are you an applicant?{" "}
            <a href="http://localhost:3002/register" className="text-primary hover:underline">Register on the public portal →</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Resend verification email button ─────────────────────────────────────────
function ResendButton({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function resend() {
    setStatus("loading");
    const token = localStorage.getItem("wtc_token");
    try {
      const res = await fetch(`${API}/auth/email/resend`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <p className="text-sm text-green-600 font-medium">✓ Verification email resent to {email}</p>;
  }

  return (
    <Button variant="outline" className="w-full" onClick={resend} disabled={status === "loading"}>
      {status === "loading" ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</> :
        status === "error" ? "Failed to resend — try again" : "Resend verification email"}
    </Button>
  );
}

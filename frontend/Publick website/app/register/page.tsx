"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CONSULTANT_WEBSITE_URL } from "@/lib/dashboard-urls";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

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
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | null>(null);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.errors) {
          const flat: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors as Record<string, string[]>)) {
            flat[k] = (v as string[])[0];
          }
          setFieldErrors(flat);
        } else {
          setError(data?.message || "Registration failed. Please try again.");
        }
        return;
      }
      window.location.replace("/login?registered=1");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setOauthLoading("google");
    setError("");
    try {
      const res = await fetch(`${API}/auth/google/redirect`, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json();
      if (data?.redirect_url) {
        sessionStorage.setItem("wtc_oauth_source", "register");
        window.location.href = data.redirect_url;
      } else {
        setError("Could not initiate Google sign-up. Please try again.");
        setOauthLoading(null);
      }
    } catch {
      setError("Failed to start Google sign-up. Please try again.");
      setOauthLoading(null);
    }
  }

  return (
    <div className="rcic-login-page min-h-screen flex">
      <div className="rcic-login-brand-panel relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden p-12">
        <div className="rcic-login-brand-bg absolute inset-0" />
        <div className="rcic-login-brand-glow absolute inset-0" />

        <div className="relative z-10">
          <Link href="/" className="rcic-login-brand-logo inline-flex items-center gap-2 font-bold text-xl">
            <Image src="/figma-assets/logo-footer.svg" alt="RCICMASTER" width={167} height={36} priority />
          </Link>
        </div>

        <div className="rcic-login-welcome relative z-10">
          <h2>
            <strong>Start your journey</strong>
            <span>to Canada today</span>
          </h2>
          <div className="rcic-login-accent" />
          <p className="rcic-login-welcome-copy">
            Create a free applicant account to begin your
            <br /> assessment, share documents securely, and work
            <br /> with a certified RCIC consultant.
          </p>
          <div className="rcic-login-features">
            <div>
              <span>
                <ClipboardList aria-hidden="true" />
              </span>
              <b>
                Free Eligibility
                <br />
                Assessment
              </b>
            </div>
            <i />
            <div>
              <span>
                <FileText aria-hidden="true" />
              </span>
              <b>
                Secure Docs &amp;
                <br />
                Tracking
              </b>
            </div>
            <i />
            <div>
              <span>
                <CheckCircle2 aria-hidden="true" />
              </span>
              <b>
                Matched with
                <br />
                an RCIC
              </b>
            </div>
          </div>
        </div>

        <p className="rcic-login-copyright relative z-10 text-xs">
          © {new Date().getFullYear()} RCICMASTER. Trusted by applicants worldwide.
        </p>
      </div>

      <div className="rcic-login-form-panel relative flex flex-1 items-center justify-center overflow-y-auto px-6 py-12">
        <div className="w-full max-w-lg">
          <Link href="/" className="rcic-login-mobile-logo mb-8 flex items-center justify-center lg:hidden">
            <Image src="/figma-assets/logo-header.svg" alt="RCICMASTER" width={200} height={44} priority />
          </Link>

          <div className="rcic-login-card rcic-register-card rounded-2xl border border-border/80 bg-card p-8 shadow-xl">
            <div className="rcic-register-header">
              <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Join thousands of people on their way to Canada — we&apos;ll email a verification link to get you
                started.
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">First name</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    type="text"
                    autoComplete="given-name"
                    required
                    placeholder="John"
                    value={form.first_name}
                    onChange={(e) => set("first_name", e.target.value)}
                    aria-invalid={!!fieldErrors.first_name}
                  />
                  {fieldErrors.first_name && <p className="text-xs text-destructive">{fieldErrors.first_name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    type="text"
                    autoComplete="family-name"
                    required
                    placeholder="Doe"
                    value={form.last_name}
                    onChange={(e) => set("last_name", e.target.value)}
                    aria-invalid={!!fieldErrors.last_name}
                  />
                  {fieldErrors.last_name && <p className="text-xs text-destructive">{fieldErrors.last_name}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  aria-invalid={!!fieldErrors.email}
                />
                {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  Phone number <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+1 (000) 000-0000"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder="Min. 8 characters"
                    className="pr-10"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    aria-invalid={!!fieldErrors.password}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm_password">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    name="password_confirmation"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder="Re-enter your password"
                    className="pr-10"
                    value={form.password_confirmation}
                    onChange={(e) => set("password_confirmation", e.target.value)}
                    aria-invalid={!!fieldErrors.password_confirmation}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password_confirmation && (
                  <p className="text-xs text-destructive">{fieldErrors.password_confirmation}</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                By creating an account, you agree to our{" "}
                <Link href="#" className="rcic-login-link hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="#" className="rcic-login-link hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>

              <Button
                type="submit"
                className="rcic-login-submit rcic-register-submit w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <div className="rcic-register-separator flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or sign up with</span>
              <Separator className="flex-1" />
            </div>

            <Button
              variant="outline"
              type="button"
              className="rcic-login-google rcic-register-google w-full gap-2"
              disabled={!!oauthLoading}
              onClick={handleGoogle}
            >
              {oauthLoading === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              Continue with Google
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="rcic-login-link font-medium hover:underline">
              Sign in
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Are you a consultant?{" "}
            <a href={`${CONSULTANT_WEBSITE_URL}/register`} className="rcic-login-link hover:underline">
              Consultant registration →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

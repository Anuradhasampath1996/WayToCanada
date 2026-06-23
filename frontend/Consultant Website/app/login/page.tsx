"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  CheckCircle2,
  Eye,
  EyeOff,
  LayoutDashboard,
  Loader2,
  Shield,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;
const CONSULTANT_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL ?? "http://localhost:3005";
const ADMIN_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_ADMIN_DASHBOARD_URL ?? "http://localhost:3001";
const PUBLIC_USERS_URL =
  process.env.NEXT_PUBLIC_USER_DASHBOARD_URL ?? "http://localhost:3002";

const HIGHLIGHTS = [
  "Manage clients and case files in one workspace",
  "IRCC forms, legislation hub, and OCR tools",
  "Secure messaging and deadline alerts",
  "CICC-compliant documentation trail",
];

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (searchParams.get("verified") === "1") setVerified(true);
    if (searchParams.get("registered") === "1") setRegistered(true);

    async function resumeSession() {
      const cookieMatch = document.cookie.match(/(^| )wtc_consultant_token=([^;]+)/);
      const rawToken = cookieMatch?.[2] ?? null;
      if (!rawToken) return;

      const token = decodeURIComponent(rawToken);
      try {
        const res = await fetch(`${API}/me`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (!res.ok) {
          document.cookie = "wtc_consultant_token=; path=/; max-age=0; SameSite=Lax";
          return;
        }
        window.location.replace(`${CONSULTANT_DASHBOARD_URL}/consultantdashboard`);
      } catch {
        // ignore — user can sign in manually
      }
    }

    resumeSession();
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || data?.errors?.email?.[0] || "Invalid credentials.");
        return;
      }
      const roles: string[] = data?.user?.roles ?? [];

      if (roles.includes("client")) {
        setError("This account is for applicants. Please use the Public Portal.");
        return;
      }
      if (!roles.includes("rcic") && !roles.includes("super-admin") && !roles.includes("admin")) {
        setError("Your account does not have consultant access. Contact support.");
        return;
      }

      if (roles.includes("super-admin") || roles.includes("admin")) {
        window.location.href = `${ADMIN_DASHBOARD_URL}/dashboard`;
        return;
      }

      window.location.href = `${CONSULTANT_DASHBOARD_URL}/auth/callback#token=${data.token}`;
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/auth/google/consultant/login`, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json();
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        setError("Could not initiate Google sign-in. Please try again.");
        setGoogleLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-muted/20">
      {/* Left panel */}
      <div className="relative hidden lg:flex lg:w-[46%] flex-col justify-between overflow-hidden p-12 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700" />
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_80%,white_0%,transparent_45%)]" />
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl">
            <Briefcase className="h-6 w-6" />
            <span>RCICMASTER</span>
            <Badge className="border-white/30 bg-white/15 text-white hover:bg-white/15">Consultants</Badge>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              RCIC workspace
            </div>
            <h2 className="text-3xl font-extrabold leading-tight xl:text-4xl">
              Welcome back to your practice hub
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-emerald-50/90">
              Sign in to manage clients, track applications, and access the tools built for
              modern immigration consultants.
            </p>
          </div>

          <ul className="space-y-3.5">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-emerald-50/95">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                {item}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Consultant Dashboard</p>
              <p className="text-xs text-emerald-100/80">Clients · Cases · Documents · Messaging</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 flex items-center gap-2 text-xs text-emerald-100/70">
          <Shield className="h-3.5 w-3.5" />
          © {new Date().getFullYear()} RCICMASTER · Secure consultant portal
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border/80 bg-card p-8 shadow-xl shadow-emerald-500/5 sm:p-10">
            <Link
              href="/"
              className="mb-8 flex lg:hidden items-center justify-center gap-2 font-bold text-xl text-emerald-700">
              <Briefcase className="h-6 w-6" />
              <span>RCICMASTER</span>
            </Link>

            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                Consultant sign in
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Access your dashboard
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your credentials or continue with Google
              </p>
            </div>

            {registered && (
              <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Registration successful! Please sign in to continue.
              </div>
            )}

            {verified && (
              <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Email verified — you can now sign in.
              </div>
            )}

            {error && (
              <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="h-11 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 w-full bg-emerald-600 text-base font-semibold shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
                disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            <Button
              variant="outline"
              type="button"
              className="h-11 w-full gap-2 border-border/80 font-medium"
              onClick={handleGoogle}
              disabled={googleLoading}>
              {googleLoading ? (
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

            <div className="mt-8 space-y-3 text-center text-sm">
              <p className="text-muted-foreground">
                Not a consultant yet?{" "}
                <Link href="/register" className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline">
                  Register free →
                </Link>
              </p>
              <p className="text-xs text-muted-foreground">
                Are you an applicant?{" "}
                <a href={`${PUBLIC_USERS_URL}/login`} className="text-emerald-600 hover:underline">
                  Go to public portal
                </a>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link href="/" className="hover:text-emerald-600 hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      }>
      <LoginPageContent />
    </Suspense>
  );
}

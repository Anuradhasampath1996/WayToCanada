"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Mail,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CONSULTANT_WEBSITE_URL, USER_DASHBOARD_URL } from "@/lib/dashboard-urls";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState<"registered" | "registered_google" | "verified" | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("registered") === "1") {
      const source = params.get("source");
      setBanner(source === "google" ? "registered_google" : "registered");
    } else if (params.get("verified") === "1") {
      setBanner("verified");
    }

    const match = document.cookie.match(/(^| )wtc_token=([^;]+)/);
    if (match) {
      window.location.replace(`${USER_DASHBOARD_URL}/user-dashboard`);
    }
  }, []);

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

      if (roles.includes("rcic") || roles.includes("admin") || roles.includes("super-admin")) {
        setError("This account belongs to a consultant or admin. Please use the Consultant Portal.");
        return;
      }

      window.location.replace(`${USER_DASHBOARD_URL}/auth/callback#token=${data.token}`);
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
        window.location.href = data.redirect_url;
      } else {
        setError("Could not initiate Google sign-in. Please try again.");
        setOauthLoading(null);
      }
    } catch {
      setError("Failed to start Google sign-in. Please try again.");
      setOauthLoading(null);
    }
  }

  return (
    <div className="rcic-login-page min-h-screen flex">
      <div className="rcic-login-brand-panel relative hidden lg:flex lg:w-[46%] flex-col justify-between overflow-hidden p-12">
        <div className="rcic-login-brand-bg absolute inset-0" />
        <div className="rcic-login-brand-glow absolute inset-0" />
        <div className="relative z-10">
          <Link href="/" className="rcic-login-brand-logo inline-flex items-center gap-2 font-bold text-xl">
            <Image src="/figma-assets/logo-footer.svg" alt="RCICMASTER" width={167} height={36} priority />
          </Link>
        </div>

        <div className="rcic-login-welcome relative z-10">
          <h2>
            <strong>Welcome back</strong>
            <span>to your immigration journey</span>
          </h2>
          <div className="rcic-login-accent" />
          <p className="rcic-login-welcome-copy">
            Track your application, upload documents, and stay
            <br /> connected with your RCIC consultant — all in one
            <br /> secure applicant workspace.
          </p>
          <div className="rcic-login-features">
            <div>
              <span>
                <ClipboardList aria-hidden="true" />
              </span>
              <b>
                Eligibility &amp;
                <br />
                Assessments
              </b>
            </div>
            <i />
            <div>
              <span>
                <FileText aria-hidden="true" />
              </span>
              <b>
                Docs &amp;
                <br />
                Case Tracking
              </b>
            </div>
            <i />
            <div>
              <span>
                <CheckCircle2 aria-hidden="true" />
              </span>
              <b>
                Guided Steps
                <br />
                to Canada
              </b>
            </div>
          </div>
        </div>

        <p className="rcic-login-copyright relative z-10 text-xs">
          © {new Date().getFullYear()} RCICMASTER. Trusted by applicants worldwide.
        </p>
      </div>

      <div className="rcic-login-form-panel relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="w-full max-w-md">
          <div className="rcic-login-card rounded-2xl border border-border/80 bg-card p-8 shadow-xl sm:p-10">
            <Link
              href="/"
              className="rcic-login-mobile-logo mb-8 flex lg:hidden items-center justify-center gap-2 font-bold text-xl"
            >
              <Image src="/figma-assets/logo-header.svg" alt="RCICMASTER" width={200} height={44} priority />
            </Link>

            <div className="rcic-login-card-header mb-8">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sign in</h1>
              <p className="mt-2 text-sm text-muted-foreground">Enter your credentials to continue</p>
            </div>

            {banner === "registered" && (
              <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Account created! Please check your email and verify your address, then sign in.
              </div>
            )}
            {banner === "registered_google" && (
              <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Account created with Google! Use <strong>Continue with Google</strong> to sign in, or set a password via{" "}
                <Link href="/forgot-password" className="rcic-login-link font-medium underline">
                  Forgot password
                </Link>
                .
              </div>
            )}
            {banner === "verified" && (
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
                <div className="rcic-login-input-wrap">
                  <Mail className="rcic-login-input-icon" aria-hidden="true" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    className="h-11 pr-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="rcic-login-link text-xs font-medium hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="rcic-login-input-wrap">
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
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="rcic-login-submit h-11 w-full text-base font-semibold shadow-md"
                disabled={loading}
              >
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
              className="rcic-login-google h-11 w-full gap-2 border-border/80 font-medium"
              onClick={handleGoogle}
              disabled={!!oauthLoading}
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

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="rcic-login-link font-medium hover:underline">
                Create one free
              </Link>
            </p>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Are you a consultant?{" "}
              <a href={`${CONSULTANT_WEBSITE_URL}/login`} className="rcic-login-link hover:underline">
                Consultant Portal →
              </a>
            </p>
          </div>
        </div>
        <p className="rcic-login-right-privacy absolute bottom-7 flex items-center gap-2 text-xs">
          <Shield className="h-4 w-4" />
          Secure <i /> Private <i /> Trusted by Applicants
        </p>
      </div>
    </div>
  );
}

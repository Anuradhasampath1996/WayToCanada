"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Bell,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Shield,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import "./admin-login.css";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (getCookie("wtc_admin_token")) {
      router.replace("/admindashboard");
    }
  }, [router]);

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

      if (!roles.includes("super-admin") && !roles.includes("admin")) {
        setError("Access denied. This portal is for administrators only.");
        return;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("wtc_admin_token", data.token);
        localStorage.setItem("wtc_admin_user", JSON.stringify(data.user));
        const maxAge = 60 * 60 * 24 * 30;
        document.cookie = `wtc_admin_token=${data.token}; path=/; max-age=${maxAge}; SameSite=Lax`;
      }

      router.push("/admindashboard");
    } catch {
      setError("Network error. Is the backend server running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    try {
      // Reuse consultant Google login start; callback routes admins to the admin portal.
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
    <div className="rcic-login-page min-h-screen flex">
      <div className="rcic-login-brand-panel relative hidden lg:flex lg:w-[46%] flex-col justify-between overflow-hidden p-12">
        <div className="rcic-login-brand-bg absolute inset-0" />
        <div className="rcic-login-brand-glow absolute inset-0" />
        <div className="relative z-10">
          <Link href="/admindashboard" className="rcic-login-brand-logo inline-flex items-center gap-2 font-bold text-xl">
            <Image src="/logo.png" alt="RCIC MASTER" width={167} height={36} priority />
          </Link>
        </div>

        <div className="rcic-login-welcome relative z-10">
          <h2>
            <strong>Welcome back</strong>
            <span>to your admin hub</span>
          </h2>
          <div className="rcic-login-accent" />
          <p className="rcic-login-welcome-copy">
            Manage users, consultants, billing, and
            <br /> platform settings for RCICMASTER —
            <br /> all in one secure workspace.
          </p>
          <div className="rcic-login-features">
            <div>
              <span>
                <Users aria-hidden="true" />
              </span>
              <b>
                Users &amp; Access
                <br />
                Control
              </b>
            </div>
            <i />
            <div>
              <span>
                <CreditCard aria-hidden="true" />
              </span>
              <b>
                Billing &amp;
                <br />
                Packages
              </b>
            </div>
            <i />
            <div>
              <span>
                <Bell aria-hidden="true" />
              </span>
              <b>
                Platform
                <br />
                Oversight
              </b>
            </div>
          </div>
        </div>

        <p className="rcic-login-copyright relative z-10 text-xs">
          © {new Date().getFullYear()} RCICMASTER Admin
        </p>
      </div>

      <div className="rcic-login-form-panel relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="w-full max-w-md">
          <div className="rcic-login-card rounded-2xl border border-border/80 bg-card p-8 shadow-xl sm:p-10">
            <Link
              href="/dashboard/login"
              className="rcic-login-mobile-logo mb-8 flex lg:hidden items-center justify-center gap-2 font-bold text-xl"
            >
              <Image src="/logo.png" alt="RCIC MASTER" width={200} height={44} priority />
            </Link>

            <div className="rcic-login-card-header mb-8">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sign in</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your credentials to continue
              </p>
            </div>

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
                  <Link
                    href="/dashboard/forgot-password"
                    className="rcic-login-link text-xs font-medium hover:underline"
                  >
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
              disabled={googleLoading}
            >
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
          </div>
        </div>
        <p className="rcic-login-right-privacy absolute bottom-7 flex items-center gap-2 text-xs">
          <Shield className="h-4 w-4" />
          Secure <i /> Private <i /> Trusted by Admins
        </p>
      </div>
    </div>
  );
}

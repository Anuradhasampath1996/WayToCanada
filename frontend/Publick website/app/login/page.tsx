"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;
const USER_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_USER_DASHBOARD_URL ?? "http://localhost:3001";
const CONSULTANT_WEBSITE_URL =
  process.env.NEXT_PUBLIC_CONSULTANT_WEBSITE_URL ?? "http://localhost:3002";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [banner, setBanner] = useState<"registered" | "registered_google" | "verified" | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("registered") === "1") {
      const source = params.get("source");
      setBanner(source === "google" ? "registered_google" : "registered");
    } else if (params.get("verified") === "1") setBanner("verified");

    // Redirect already-logged-in public users to the dashboard
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
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || data?.errors?.email?.[0] || "Invalid credentials.");
        return;
      }
      const roles: string[] = data?.user?.roles ?? [];

      // Validate role BEFORE storing anything
      if (roles.includes("rcic") || roles.includes("admin") || roles.includes("super-admin")) {
        setError("This account belongs to a consultant or admin. Please use the Consultant Portal.");
        return;
      }

      // client role → redirect to user dashboard (callback page sets the cookie)
      window.location.replace(`${USER_DASHBOARD_URL}/auth/callback#token=${data.token}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    setOauthLoading(provider);
    try {
      const endpoint = provider === "google" ? `${API}/auth/google/redirect` : `${API}/auth/github/redirect`;
      const res = await fetch(endpoint, { headers: { "Accept": "application/json" } });
      const data = await res.json();
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      }
    } catch {
      setError("Failed to start OAuth. Please try again.");
      setOauthLoading(null);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 text-primary-foreground">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <MapPin className="h-6 w-6" />
          <span>WayToCanada</span>
        </Link>
        <div className="space-y-4">
          <blockquote className="text-2xl font-semibold leading-snug">
            &ldquo;WayToCanada made my immigration journey simple and stress-free. I received my PR in
            just 8 months!&rdquo;
          </blockquote>
          <p className="text-primary-foreground/80 text-sm">— Priya Sharma, Express Entry Applicant</p>
        </div>
        <p className="text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} WayToCanada. Trusted by 10,000+ applicants worldwide.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <Link href="/" className="flex lg:hidden items-center gap-2 font-bold text-xl text-primary justify-center">
            <MapPin className="h-6 w-6" />
            <span>WayToCanada</span>
          </Link>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to your WayToCanada account</p>
          </div>

          {banner === "registered" && (
            <div className="rounded-md bg-green-50 border border-green-300 px-4 py-3 text-sm text-green-800">
              Account created! Please check your email and verify your address, then sign in.
            </div>
          )}
          {banner === "registered_google" && (
            <div className="rounded-md bg-green-50 border border-green-300 px-4 py-3 text-sm text-green-800">
              Account created with Google! Use <strong>Continue with Google</strong> to sign in, or set a password via{" "}
              <Link href="/forgot-password" className="font-medium underline">
                Forgot password
              </Link>
              .
            </div>
          )}
          {banner === "verified" && (
            <div className="rounded-md bg-green-50 border border-green-300 px-4 py-3 text-sm text-green-800">
              Email verified! You can now sign in.
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or continue with</span>
            <Separator className="flex-1" />
          </div>

          <div className="flex">
            <Button
              variant="outline"
              type="button"
              className="w-full gap-2"
              disabled={!!oauthLoading}
              onClick={() => handleOAuth("google")}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {oauthLoading === "google" ? "Redirecting…" : "Continue with Google"}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Create one free
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Are you a consultant?{" "}
            <a href={`${CONSULTANT_WEBSITE_URL}/login`} className="text-primary hover:underline">
              Consultant Portal →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

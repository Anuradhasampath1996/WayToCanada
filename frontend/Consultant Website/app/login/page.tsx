"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Briefcase, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const API = "http://127.0.0.1:8000/api/v1";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (searchParams.get("verified") === "1") setVerified(true);
    if (searchParams.get("registered") === "1") setRegistered(true);
  }, [searchParams]);

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
      localStorage.setItem("wtc_consultant_token", data.token);
      localStorage.setItem("wtc_consultant_user", JSON.stringify(data.user));

      if (roles.includes("client")) {
        setError("This account is for applicants. Please use the Public Portal.");
        localStorage.removeItem("wtc_consultant_token");
        localStorage.removeItem("wtc_consultant_user");
        return;
      }
      if (roles.includes("super-admin") || roles.includes("admin")) {
        window.location.href = "http://localhost:3000/dashboard";
        return;
      }
      if (roles.includes("rcic")) {
        // Redirect to Consultant Dashboard
        window.location.href = "http://localhost:3004/auth/callback#token=" + data.token;
        return;
      }
      setError("Your account does not have consultant access. Contact support.");
      localStorage.removeItem("wtc_consultant_token");
      localStorage.removeItem("wtc_consultant_user");
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
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 text-primary-foreground">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Briefcase className="h-6 w-6" />
          <span>WayToCanada</span>
          <Badge variant="secondary" className="text-xs text-primary ml-1">Consultants</Badge>
        </Link>
        <div className="space-y-6">
          <h2 className="text-3xl font-extrabold leading-snug">Welcome Back, Consultant</h2>
          <ul className="space-y-3 text-sm text-primary-foreground/90">
            {[
              "View and manage all your active clients",
              "Track application stages and deadlines",
              "Access the legal resource library",
              "Receive new client match notifications"
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground shrink-0" />
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
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <Link href="/" className="flex lg:hidden items-center gap-2 font-bold text-xl text-primary justify-center">
            <Briefcase className="h-6 w-6" />
            <span>WayToCanada</span>
          </Link>

          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Consultant Portal</p>
            <h1 className="text-3xl font-bold tracking-tight">Sign in to your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Access your consultant dashboard and manage your clients
            </p>
          </div>

          {registered && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              🎉 Registration successful! Please sign in to continue.
            </div>
          )}

          {verified && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              ✓ Email verified! You can now sign in.
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
            Not a consultant yet?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Apply to join
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Are you an applicant?{" "}
            <a href="http://localhost:3001/login" className="text-primary hover:underline">
              Go to public portal →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

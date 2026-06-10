"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

export default function RegisterPage() {
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", password: "", password_confirmation: ""
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
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
      // Success — redirect to login with banner
      window.location.replace("/login?registered=1");
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
        // Mark that OAuth was triggered from the register page so the
        // callback can redirect to login with a success banner instead
        // of forwarding directly to the dashboard.
        sessionStorage.setItem("wtc_oauth_source", "register");
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
        <div className="space-y-6">
          <h2 className="text-3xl font-extrabold leading-snug">
            Start Your Canadian Journey Today
          </h2>
          <ul className="space-y-3 text-sm text-primary-foreground/90">
            {[
              "Free eligibility assessment in minutes",
              "Matched with a certified RCIC consultant",
              "Real-time application tracking dashboard",
              "Secure document upload & management"
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} WayToCanada. Trusted by 10,000+ applicants worldwide.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <Link href="/" className="flex lg:hidden items-center gap-2 font-bold text-xl text-primary justify-center">
            <MapPin className="h-6 w-6" />
            <span>WayToCanada</span>
          </Link>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Join thousands of people on their way to Canada
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">First name</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  type="text"
                  required
                  placeholder="John"
                  value={form.first_name}
                  onChange={e => set("first_name", e.target.value)}
                />
                {fieldErrors.first_name && <p className="text-xs text-destructive">{fieldErrors.first_name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Last name</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  type="text"
                  required
                  placeholder="Doe"
                  value={form.last_name}
                  onChange={e => set("last_name", e.target.value)}
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
                onChange={e => set("email", e.target.value)}
              />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+1 (000) 000-0000"
                value={form.phone}
                onChange={e => set("phone", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={e => set("password", e.target.value)}
              />
              {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Confirm password</Label>
              <Input
                id="confirm_password"
                name="password_confirmation"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Re-enter your password"
                value={form.password_confirmation}
                onChange={e => set("password_confirmation", e.target.value)}
              />
              {fieldErrors.password_confirmation && <p className="text-xs text-destructive">{fieldErrors.password_confirmation}</p>}
            </div>

            <p className="text-xs text-muted-foreground">
              By creating an account, you agree to our{" "}
              <Link href="#" className="text-primary hover:underline">Terms of Service</Link>{" "}
              and{" "}
              <Link href="#" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or sign up with</span>
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
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

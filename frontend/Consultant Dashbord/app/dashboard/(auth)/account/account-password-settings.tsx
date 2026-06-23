"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CONSULTANT_WEBSITE_URL } from "@/lib/auth-urls";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(json = true): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ?? localStorage.getItem("wtc_consultant_token") ?? "";
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {}),
    Accept: "application/json",
  };
}

type MeUser = {
  email: string;
  has_password: boolean;
  auth_providers: string[];
};

export function AccountPasswordSettings() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/me`, { headers: authHeaders(false) });
      if (!res.ok) throw new Error("Could not load sign-in settings.");
      setUser(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sign-in settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, string> = {
        password,
        password_confirmation: passwordConfirm,
      };
      if (user?.has_password) body.current_password = currentPassword;

      const res = await fetch(`${API}/set-password`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data?.message ??
          data?.errors?.current_password?.[0] ??
          data?.errors?.password?.[0] ??
          "Could not update password.";
        throw new Error(msg);
      }
      setMessage(data.message ?? "Password updated.");
      setCurrentPassword("");
      setPassword("");
      setPasswordConfirm("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading sign-in settings…
      </div>
    );
  }

  if (!user) {
    return <p className="text-sm text-destructive">{error ?? "Could not load sign-in settings."}</p>;
  }

  const oauthProviders = (user.auth_providers ?? []).filter((p) => p !== "password");

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="rounded-xl border bg-muted/20 px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">Sign-in methods on this account</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {user.has_password && <Badge variant="secondary">Email & password</Badge>}
          {oauthProviders.map((provider) => (
            <Badge key={provider} variant="outline" className="capitalize">
              {provider}
            </Badge>
          ))}
          {!user.has_password && oauthProviders.length === 0 && (
            <span className="text-sm text-muted-foreground">No sign-in methods found.</span>
          )}
        </div>
        {oauthProviders.includes("google") && (
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            You can sign in with Google and email/password at the same time. Adding a password does not disable Google sign-in.
          </p>
        )}
      </div>

      <form onSubmit={savePassword} className="w-full max-w-md space-y-4">
        {message && (
          <p className="break-words rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            {message}
          </p>
        )}
        {error && (
          <p className="break-words rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </p>
        )}

        {user.has_password && (
          <div className="space-y-2">
            <Label htmlFor="consultant-current-password">Current password</Label>
            <Input
              id="consultant-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-10"
              required
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="consultant-new-password">{user.has_password ? "New password" : "Password"}</Label>
          <Input
            id="consultant-new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10"
            minLength={8}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="consultant-confirm-password">Confirm password</Label>
          <Input
            id="consultant-confirm-password"
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="h-10"
            minLength={8}
            required
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button type="submit" disabled={saving} className="h-10 w-full gap-1.5 sm:w-auto">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                {user.has_password ? "Update password" : "Save password"}
              </>
            )}
          </Button>
          {user.has_password && (
            <Button type="button" variant="outline" className="h-10 w-full sm:w-auto" asChild>
              <Link href={`${CONSULTANT_WEBSITE_URL}/forgot-password`} target="_blank" rel="noopener noreferrer">
                <KeyRound className="mr-1.5 h-4 w-4" />
                Reset via email
              </Link>
            </Button>
          )}
        </div>

        {!user.has_password && oauthProviders.length > 0 && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            After you save a password, you can still use {oauthProviders.join(" or ")} to sign in.
          </p>
        )}
      </form>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell, KeyRound, Loader2, Mail, ShieldCheck, UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CLIENT_API, clientAuthHeaders } from "@/lib/client-api";
import { useClientJourneyOptional } from "@/context/client-journey-context";

type MeUser = {
  name: string;
  email: string;
  avatar?: string | null;
  has_password: boolean;
  auth_providers: string[];
  created_at?: string | null;
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function AccountPage() {
  const journey = useClientJourneyOptional();
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
      const res = await fetch(`${CLIENT_API}/me`, { headers: clientAuthHeaders(false) });
      if (!res.ok) throw new Error("Could not load account.");
      setUser(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load account.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

      const res = await fetch(`${CLIENT_API}/set-password`, {
        method: "POST",
        headers: clientAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.message ?? data?.errors?.current_password?.[0] ?? data?.errors?.password?.[0] ?? "Could not update password.";
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

  const consultant = journey?.consultant;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your login details and security settings.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {user && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCircle2 className="size-4" />
                Profile
              </CardTitle>
              <CardDescription>Information from your RCICMASTER account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{user.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Email</p>
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Mail className="size-3.5 text-muted-foreground" />
                    {user.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Member since</p>
                  <p className="text-sm">{fmtDate(user.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Sign-in methods</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {user.has_password && <Badge variant="secondary">Email & password</Badge>}
                    {user.auth_providers?.map((p) => (
                      <Badge key={p} variant="outline" className="capitalize">{p}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              {consultant && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your consultant</p>
                  <p className="mt-1 font-medium">{consultant.name}</p>
                  {consultant.rcic_number && (
                    <p className="text-xs text-muted-foreground">RCIC {consultant.rcic_number}</p>
                  )}
                </div>
              )}

              <Button variant="outline" size="sm" className="rounded-lg" asChild>
                <Link href="/user-dashboard/notifications">
                  <Bell className="mr-1.5 size-4" />
                  Notification preferences
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="size-4" />
                {user.has_password ? "Change password" : "Set a password"}
              </CardTitle>
              <CardDescription>
                {user.has_password
                  ? "Use a strong password you do not use on other sites."
                  : "Add a password so you can sign in with email as well as Google."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={savePassword} className="space-y-4">
                {message && (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
                )}
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                )}
                {user.has_password && (
                  <div className="space-y-2">
                    <Label htmlFor="current">Current password</Label>
                    <Input
                      id="current"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <Button type="submit" disabled={saving} className="rounded-lg">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : (
                    <>
                      <ShieldCheck className="mr-1.5 size-4" />
                      {user.has_password ? "Update password" : "Save password"}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

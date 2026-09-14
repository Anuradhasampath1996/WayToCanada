"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;
const CONSULTANT_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL ?? "http://localhost:3005";

export default function TeamInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<{ email: string; name: string; firm_name: string | null; expires_at: string | null } | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API}/team/invitations/${token}`, { headers: { Accept: "application/json" } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data?.message ?? "This invitation is not available.");
          return;
        }
        setInvite(data);
        setName(data.name ?? "");
      })
      .catch(() => setError("Could not load this invitation."))
      .finally(() => setLoading(false));
  }, [token]);

  async function accept() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API}/team/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.errors?.password?.[0] ?? data?.errors?.email?.[0] ?? data?.message ?? "Could not activate this invitation.");
        return;
      }
      localStorage.setItem("wtc_consultant_token", data.token);
      localStorage.setItem("wtc_consultant_user", JSON.stringify(data.user));
      document.cookie = `wtc_consultant_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      window.location.href = `${CONSULTANT_DASHBOARD_URL}/auth/callback#token=${data.token}`;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rcic-login-page flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <h1 className="text-xl font-semibold">Join a practice workspace</h1>
        {loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking invitation…</p>
        ) : invite ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {invite.firm_name ?? "A consultant"} invited <strong>{invite.email}</strong>. Create your own password — you will never share the consultant login.
            </p>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password</Label>
              <Input type="password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="w-full" disabled={submitting || password.length < 8} onClick={() => void accept()}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create account
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-red-600">{error || "Invitation not found."}</p>
            <Button asChild variant="outline"><Link href="/login">Go to sign in</Link></Button>
          </div>
        )}
      </div>
    </div>
  );
}

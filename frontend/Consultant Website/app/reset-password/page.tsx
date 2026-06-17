"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function ResetPasswordForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token, email, password, password_confirmation: passwordConfirmation }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || data?.errors?.email?.[0] || "Reset failed.");
        return;
      }
      setMessage(data.message || "Password updated.");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  if (!token || !email) {
    return (
      <p className="text-sm text-destructive">
        Invalid link. <Link href="/forgot-password" className="underline">Request a new one</Link>.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Email</Label>
        <Input value={email} readOnly className="bg-muted" />
      </div>
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
      </div>
      <div>
        <Label htmlFor="password_confirmation">Confirm password</Label>
        <Input id="password_confirmation" type="password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} minLength={8} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && (
        <p className="text-sm text-green-700">
          {message} <Link href="/login" className="underline">Sign in</Link>
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading || !!message}>
        {loading ? "Saving…" : "Set password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="mb-2 text-2xl font-bold">Set new password</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}

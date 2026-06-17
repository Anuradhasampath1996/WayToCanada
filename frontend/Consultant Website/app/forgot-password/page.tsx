"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || data?.errors?.email?.[0] || "Request failed.");
        return;
      }
      setMessage(data.message || "Check your email for reset instructions.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="mb-2 text-2xl font-bold">Forgot password</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Google account එකෙන් register වුණා නම්ත් මෙතනින් email password එකක් create කරන්න පුළුවන්.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}

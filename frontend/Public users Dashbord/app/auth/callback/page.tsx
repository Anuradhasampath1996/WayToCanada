"use client";

import { useEffect } from "react";

const API = "http://127.0.0.1:8000/api/v1";

export default function AuthCallbackPage() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get("token");

    if (!token) {
      window.location.replace("http://localhost:3002/login?error=oauth_failed");
      return;
    }

    // Store token as a cookie so middleware can read it
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    document.cookie = `wtc_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;

    // Fetch and store user info in localStorage for UI use
    fetch(`${API}/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
      .then(res => res.json())
      .then(user => {
        localStorage.setItem("wtc_user", JSON.stringify(user));
      })
      .catch(() => {})
      .finally(() => {
        window.location.replace("/dashboard/default");
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm">Signing you in…</p>
    </div>
  );
}

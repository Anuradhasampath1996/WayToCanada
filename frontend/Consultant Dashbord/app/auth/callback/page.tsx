"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("token");

    if (!token) {
      window.location.replace("http://localhost:3001/login");
      return;
    }

    // Save token immediately (synchronous) before any navigation
    localStorage.setItem("wtc_consultant_token", token);

    fetch("http://127.0.0.1:8000/api/v1/me", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((user) => {
        localStorage.setItem("wtc_consultant_user", JSON.stringify(user));
      })
      .catch(() => {
        // token is already saved; OnboardingGuard will fetch fresh data
      })
      .finally(() => {
        // Full page navigation — guarantees a clean mount of the dashboard
        window.location.replace("/consultantdashboard");
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">Signing you in…</p>
    </div>
  );
}

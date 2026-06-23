"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { CONSULTANT_LOGIN_URL } from "@/lib/auth-urls";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export default function AuthCallbackPage() {
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("token");

    if (!token) {
      window.location.replace(CONSULTANT_LOGIN_URL);
      return;
    }

    // Save token in localStorage AND as a cookie (cookie is read by proxy for route protection)
    localStorage.setItem("wtc_consultant_token", token);
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    document.cookie = `wtc_consultant_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;

    fetch(`${API}/me`, {
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

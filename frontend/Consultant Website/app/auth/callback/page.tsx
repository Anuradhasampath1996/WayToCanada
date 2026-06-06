"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const CONSULTANT_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL ?? "http://localhost:3005";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("token");

    if (!token) {
      router.replace("/register?error=google_failed");
      return;
    }

    // Store as consultant token (cookie + localStorage) — same as dashboard callback
    localStorage.setItem("wtc_consultant_token", token);
    const maxAge = 60 * 60 * 24 * 30;
    document.cookie = `wtc_consultant_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;

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
      .catch(() => {})
      .finally(() => {
        // Go to the Consultant Dashboard
        window.location.replace(`${CONSULTANT_DASHBOARD_URL}/consultantdashboard`);
      });
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">Signing you in…</p>
    </div>
  );
}

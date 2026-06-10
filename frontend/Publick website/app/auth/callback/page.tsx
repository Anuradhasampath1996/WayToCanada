"use client";

import { useEffect } from "react";
import { MapPin } from "lucide-react";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;
const USER_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_USER_DASHBOARD_URL ?? "http://localhost:3001";

export default function AuthCallbackPage() {
  useEffect(() => {
    // Token arrives in the URL hash, e.g. /auth/callback#token=1|abc...
    const hash = window.location.hash.slice(1); // remove leading '#'
    const params = new URLSearchParams(hash);
    const token = params.get("token");

    if (!token) {
      window.location.replace("/login?error=oauth_failed");
      return;
    }

    // Check if this OAuth flow was initiated from the register page
    const oauthSource = sessionStorage.getItem("wtc_oauth_source");
    sessionStorage.removeItem("wtc_oauth_source");

    if (oauthSource === "register") {
      // New account created via Google — redirect to login with success banner
      window.location.replace("/login?registered=1&source=google");
      return;
    }

    localStorage.setItem("wtc_token", token);

    // Set token as cookie for the user dashboard app (port 3001)
    const maxAge = 60 * 60 * 24 * 30;
    document.cookie = `wtc_token=${token}; path=/; domain=localhost; max-age=${maxAge}; SameSite=Lax`;

    fetch(`${API}/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
      .then(res => res.json())
      .then(user => {
        localStorage.setItem("wtc_user", JSON.stringify(user));
      })
      .catch(() => {})
      .finally(() => {
        window.location.replace(`${USER_DASHBOARD_URL}/auth/callback#token=${token}`);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <MapPin className="h-8 w-8 text-primary animate-pulse" />
      <p className="text-sm">Signing you in…</p>
    </div>
  );
}

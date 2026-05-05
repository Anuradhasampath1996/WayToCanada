"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Token is in the URL fragment (#token=...) — not sent to the server
    const hash = window.location.hash; // e.g. "#token=3|abc..."
    const params = new URLSearchParams(hash.slice(1)); // remove leading #
    const token = params.get("token");

    if (!token) {
      // No token — something went wrong, send back to register
      router.replace("/register?error=google_failed");
      return;
    }

    // Persist token then fetch the current user
    localStorage.setItem("wtc_token", token);

    fetch("http://127.0.0.1:8000/api/v1/me", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((user) => {
        localStorage.setItem("wtc_user", JSON.stringify(user));
        // Redirect to login page with success notice instead of directly to dashboard
        router.replace("/login?registered=1");
      })
      .catch(() => {
        router.replace("/login?registered=1");
      });
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">Signing you in…</p>
    </div>
  );
}

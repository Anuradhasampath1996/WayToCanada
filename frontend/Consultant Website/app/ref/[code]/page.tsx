"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;
const CODE_COOKIE = "wtc_ref_code";

function persistCode(code: string, days = 90) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${CODE_COOKIE}=${encodeURIComponent(code)}; expires=${expires}; path=/; SameSite=Lax`;
}

export default function ReferralLandingPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [message, setMessage] = useState("Opening your referral link…");

  useEffect(() => {
    const code = String(params.code ?? "").trim();
    if (!code) {
      router.replace("/register");
      return;
    }

    persistCode(code);
    fetch(`${API}/referral/attribute/${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(data?.message ?? "This referral link is not valid.");
          setTimeout(() => router.replace("/register"), 1600);
          return;
        }
        if (data?.cookie?.value) {
          persistCode(data.code ?? code, data.cookie.days ?? 90);
        }
        router.replace(`/register?ref=${encodeURIComponent(data.code ?? code)}`);
      })
      .catch(() => {
        setMessage("Could not open this referral link. Continuing to registration.");
        router.replace(`/register?ref=${encodeURIComponent(code)}`);
      });
  }, [params.code, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {message}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ?? localStorage.getItem("wtc_consultant_token") ?? "";
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function MarketingReturnClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"activating" | "success" | "error">("activating");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setErrorMsg("Missing checkout session ID.");
      setStep("error");
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const res = await fetch(`${API}/consultant/marketing/payment/verify-session`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ session_id: sessionId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? "Payment verification failed.");
        if (!cancelled) {
          const slug = json.order?.service?.slug as string | undefined;
          setStep("success");
          setTimeout(() => {
            router.replace(slug ? `/dashboard/marketing/${slug}` : "/dashboard/marketing");
          }, 2800);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setErrorMsg(e instanceof Error ? e.message : "An unexpected error occurred.");
          setStep("error");
        }
      }
    }

    void verify();
    return () => { cancelled = true; };
  }, [sessionId, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-3 py-6 sm:px-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card px-5 py-10 text-center shadow-sm sm:space-y-6 sm:px-8 sm:py-14">
        {step === "activating" && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary sm:h-14 sm:w-14" />
            <h1 className="text-xl font-bold sm:text-2xl">Confirming payment…</h1>
            <p className="text-sm text-muted-foreground">Please wait while we verify your Stripe payment.</p>
          </>
        )}
        {step === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 sm:h-14 sm:w-14" />
            <h1 className="text-xl font-bold sm:text-2xl">Payment successful!</h1>
            <p className="text-sm text-muted-foreground">
              Our marketing team will contact you within 2 business days to get started.
            </p>
            <Megaphone className="mx-auto size-8 text-violet-600 opacity-60" />
          </>
        )}
        {step === "error" && (
          <>
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 sm:h-14 sm:w-14" />
            <h1 className="text-xl font-bold sm:text-2xl">Something went wrong</h1>
            <p className="text-sm text-muted-foreground break-words">{errorMsg}</p>
            <Button asChild variant="outline" className="h-10 w-full sm:w-auto">
              <Link href="/dashboard/marketing"><ArrowLeft className="mr-2 size-4" /> Back to Marketing</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, HardDrive, Loader2 } from "lucide-react";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(json = true): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ?? localStorage.getItem("wtc_consultant_token") ?? "";
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Accept: "application/json",
  };
}

interface Props {
  sessionId: string;
}

type Step = "activating" | "success" | "error";

export function ReturnClient({ sessionId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("activating");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setErrorMsg("Missing checkout session ID. Please try again.");
      setStep("error");
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const res = await fetch(`${API}/consultant/storage/payment/verify-session`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ session_id: sessionId }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.message ?? "Activation failed. Please contact support.");
        }
        if (!cancelled) {
          setStep("success");
          setTimeout(() => router.replace("/dashboard/storage"), 2500);
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
            <h1 className="text-xl font-bold sm:text-2xl">Unlocking extra storage…</h1>
            <p className="text-sm text-muted-foreground">Confirming your payment with Stripe.</p>
          </>
        )}

        {step === "success" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-100 sm:h-20 sm:w-20">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 sm:h-10 sm:w-10" />
            </div>
            <h1 className="text-xl font-bold sm:text-2xl">Storage upgraded!</h1>
            <p className="text-sm text-muted-foreground">
              Your extra storage is now active. Redirecting…
            </p>
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
          </>
        )}

        {step === "error" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 ring-8 ring-red-100 sm:h-16 sm:w-16">
              <AlertTriangle className="h-7 w-7 text-red-500 sm:h-8 sm:w-8" />
            </div>
            <h1 className="text-xl font-bold sm:text-2xl">Activation failed</h1>
            <p className="text-sm text-muted-foreground break-words">{errorMsg}</p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => router.push("/dashboard/storage?upgrade=1")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                <HardDrive className="h-4 w-4" />
                Try again
              </button>
              <button
                onClick={() => router.push("/dashboard/storage")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted px-5 py-3 text-sm font-semibold"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to storage
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

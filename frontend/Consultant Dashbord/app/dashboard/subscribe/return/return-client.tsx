"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

interface Props {
  sessionId: string;
}

type Step = "activating" | "success" | "error";

export function ReturnClient({ sessionId }: Props) {
  const router = useRouter();

  const [step,     setStep]     = useState<Step>("activating");
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
        const token = localStorage.getItem("wtc_consultant_token");
        const res   = await fetch(`${API}/consultant/payment/stripe/verify-session`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ session_id: sessionId }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.message ?? "Activation failed. Please contact support.");
        }

        if (!cancelled) {
          setStep("success");
          setTimeout(() => router.replace("/dashboard/default"), 2500);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl px-8 py-14 text-center space-y-6">

        {step === "activating" && (
          <>
            <Loader2 className="mx-auto h-14 w-14 animate-spin text-blue-500" />
            <h1 className="text-2xl font-bold text-slate-900">Activating your subscription…</h1>
            <p className="text-slate-500 text-sm">Please wait while we confirm your payment with Stripe.</p>
          </>
        )}

        {step === "success" && (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-100">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Subscription Activated!</h1>
            <p className="text-slate-500 text-sm">
              Your subscription is now active and will auto-renew each billing cycle.<br />
              Redirecting to your dashboard…
            </p>
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-500" />
          </>
        )}

        {step === "error" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 ring-8 ring-red-100">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Activation Failed</h1>
            <p className="text-slate-500 text-sm">{errorMsg}</p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => router.push("/dashboard/subscribe")}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push("/dashboard/default")}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Go to Dashboard
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

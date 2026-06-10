"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, XCircle } from "lucide-react";

export default function SubscribeCancelledPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl px-8 py-14 text-center space-y-6">

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 ring-8 ring-amber-100">
          <XCircle className="h-8 w-8 text-amber-500" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Payment Cancelled</h1>

        <p className="text-slate-500 text-sm leading-relaxed">
          You cancelled the Stripe checkout. No charges were made to your account.
        </p>

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => router.back()}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Back to Plans
          </button>
          <button
            onClick={() => router.push("/dashboard/default")}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}

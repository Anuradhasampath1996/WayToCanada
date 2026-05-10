"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

// ── Make TypeScript aware of the PayPal SDK injected by the script tag ──────
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PayPalSDK?: any;
  }
}

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  packageId: number;
  packageName: string;
  price: number;
  billingCycle: "monthly" | "yearly";
  lang: "en" | "fr";
  onSuccess: () => void;
  onClose: () => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// i18n
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  en: {
    title:     "Complete Payment",
    cancel:    "Cancel",
    secure:    "Payments are processed securely via PayPal.",
    error:     "Payment failed. Please try again.",
    loading:   "Loading payment processor…",
  },
  fr: {
    title:     "Compléter le paiement",
    cancel:    "Annuler",
    secure:    "Les paiements sont traités en toute sécurité via PayPal.",
    error:     "Le paiement a échoué. Veuillez réessayer.",
    loading:   "Chargement du processeur de paiement…",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Dynamically injects the PayPal JS SDK into <head> exactly once per page load.
 *
 * - If the SDK already booted successfully (PayPalSDK.Buttons is a function) → resolve immediately.
 * - If the <script> tag already exists (loading in progress) → piggyback on it.
 * - Otherwise → inject a fresh script tag.
 *
 * We must never remove-and-reload the script: PayPal's internal `zoid` listener
 * registry is global and permanent — reloading throws "Bootstrap Error: Request
 * listener already exists" which silently prevents Buttons from initialising.
 */
function loadPayPalSdk(clientId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already booted? Reuse it directly.
    if (window.PayPalSDK && typeof window.PayPalSDK.Buttons === "function") {
      resolve();
      return;
    }

    // Script tag already injected (loading or errored) — piggyback on it.
    const existing = document.getElementById("paypal-sdk-script");
    if (existing) {
      existing.addEventListener("load",  () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(
        "Failed to load the PayPal SDK. Please check your internet connection."
      )), { once: true });
      return;
    }

    // First time: inject the script.
    const script = document.createElement("script");
    script.id    = "paypal-sdk-script";
    script.async = true;
    // Use raw client_id — no encodeURIComponent — PayPal validates these directly.
    script.src   = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=CAD&intent=capture`;
    // Store under window.PayPalSDK to avoid collision with any DOM element
    // the browser auto-exposes as window.paypal (e.g. <div id="paypal">).
    script.setAttribute("data-namespace", "PayPalSDK");
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error(
      "Failed to load the PayPal SDK. Please check your internet connection."
    ));
    document.head.appendChild(script);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PaymentModal({
  packageId,
  packageName,
  price,
  billingCycle,
  lang,
  onSuccess,
  onClose,
}: Props) {
  const [initializing, setInitializing] = useState(true);
  const [processing,   setProcessing]   = useState(false);
  const [error,        setError]        = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buttonsRef   = useRef<any>(null);

  const t = T[lang];

  const formattedPrice = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    style: "currency", currency: "CAD", minimumFractionDigits: 2,
  }).format(price);
  const cycleLabel = billingCycle === "yearly"
    ? (lang === "fr" ? "/an" : "/year")
    : (lang === "fr" ? "/mois" : "/month");

  // ── Step 1: fetch PayPal config + load SDK ────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const token = localStorage.getItem("wtc_consultant_token");
        const res   = await fetch(`${API}/consultant/payment/paypal/config`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });

        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.message ?? t.error);
        }

        const json = await res.json();
        const clientId: string = (json.client_id ?? "").trim();

        if (!clientId) {
          throw new Error(
            "No PayPal Client ID found. Please save your credentials in Admin → Payment Gateways."
          );
        }

        console.info("[PayPal] loading SDK with client_id ending in …" + clientId.slice(-6));
        await loadPayPalSdk(clientId);

        if (!cancelled) setInitializing(false);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t.error);
          setInitializing(false);
        }
      }
    }

    void init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 2: render PayPal buttons once SDK is loaded ─────────────────────
  useEffect(() => {
    if (initializing || !containerRef.current || !window.PayPalSDK) return;

    if (typeof window.PayPalSDK.Buttons !== "function") {
      const available = Object.keys(window.PayPalSDK).join(", ") || "(none)";
      console.error("[PayPal] window.PayPalSDK keys:", available);
      setError(
        "PayPal loaded but could not initialise the checkout buttons. " +
        "This is usually caused by an invalid or restricted Client ID. " +
        "Open the browser console (F12) and look for PayPal SDK errors. " +
        `Available PayPal APIs: ${available}`
      );
      return;
    }

    const buttons = window.PayPalSDK.Buttons({
      style: {
        layout : "vertical",
        color  : "gold",
        shape  : "rect",
        label  : "pay",
        height : 44,
      },

      // Called when the user clicks the PayPal button — creates the order server-side
      createOrder: async () => {
        setError("");
        const token = localStorage.getItem("wtc_consultant_token");
        const res   = await fetch(`${API}/consultant/payment/paypal/create-order`, {
          method  : "POST",
          headers : {
            Authorization  : `Bearer ${token}`,
            "Content-Type" : "application/json",
            Accept         : "application/json",
          },
          body: JSON.stringify({
            subscription_package_id: packageId,
            billing_cycle          : billingCycle,
          }),
        });

        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.message ?? t.error);
        }

        const { order_id } = await res.json();
        return order_id;
      },

      // Called after the user approves the payment in the PayPal popup
      onApprove: async (data: { orderID: string }) => {
        setProcessing(true);
        setError("");

        try {
          const token = localStorage.getItem("wtc_consultant_token");
          const res   = await fetch(`${API}/consultant/payment/paypal/capture-order`, {
            method  : "POST",
            headers : {
              Authorization  : `Bearer ${token}`,
              "Content-Type" : "application/json",
              Accept         : "application/json",
            },
            body: JSON.stringify({
              order_id                 : data.orderID,
              subscription_package_id  : packageId,
              billing_cycle            : billingCycle,
            }),
          });

          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            setError(d?.message ?? t.error);
            return;
          }

          // Payment confirmed — hand off to parent
          onSuccess();
        } catch {
          setError(t.error);
        } finally {
          setProcessing(false);
        }
      },

      onError: (err: unknown) => {
        console.error("[PayPal] error:", err);
        setError(t.error);
      },

      onCancel: () => {
        setError(""); // user cancelled — no error needed
      },
    });

    if (buttons.isEligible()) {
      buttons.render(containerRef.current);
      buttonsRef.current = buttons;
    } else {
      setError("PayPal buttons are not available in your region or browser. Please try again or contact support.");
    }

    return () => {
      try { buttonsRef.current?.close(); } catch { /* ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializing]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t.title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {packageName} &mdash;&nbsp;
              {billingCycle === "yearly"
                ? (lang === "fr" ? "Forfait annuel" : "Yearly Plan")
                : (lang === "fr" ? "Forfait mensuel" : "Monthly Plan")}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">

          {/* Price summary */}
          <div className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
            <span className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
              <CreditCard className="h-4 w-4" />
              {packageName}
            </span>
            <span className="text-blue-900 font-extrabold">
              {formattedPrice}
              <span className="text-xs font-medium text-blue-600">{cycleLabel}</span>
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* PayPal buttons or loaders */}
          {initializing ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
              <span className="text-sm">{t.loading}</span>
            </div>
          ) : processing ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
              <span className="text-sm">
                {lang === "fr" ? "Traitement en cours…" : "Processing payment…"}
              </span>
            </div>
          ) : (
            <div ref={containerRef} id="paypal-button-container" className="min-h-[44px]" />
          )}

          {/* Cancel link */}
          {!processing && (
            <Button
              variant="ghost"
              className="w-full text-slate-500 hover:text-slate-700 h-9 text-sm"
              onClick={onClose}
            >
              {t.cancel}
            </Button>
          )}

          {/* Security note */}
          <p className="text-center text-xs text-slate-400">{t.secure}</p>

        </div>
      </div>
    </div>
  );
}

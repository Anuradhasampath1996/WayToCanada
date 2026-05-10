"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// ─────────────────────────────────────────────────────────────────────────────
// i18n
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  en: {
    back:           "Back to Plans",
    pageTitle:      "Complete Your Subscription",
    summary:        "Order Summary",
    billingMonthly: "Billed monthly — auto-renews every month",
    billingYearly:  "Billed annually — auto-renews every year",
    securePayment:  "Secure Payment",
    cancelAnytime:  "Cancel Anytime",
    support:        "Dedicated Support",
    autoRenew:      "Auto-Renewal",
    autoRenewDesc:  "PayPal will automatically charge your payment method each cycle. You can cancel any time from your account settings.",
    preparing:      "Preparing your subscription…",
    redirecting:    "Redirecting to PayPal…",
    btnPayPal:      "Continue to PayPal",
    total:          "Total",
    perMonth:       "/month",
    perYear:        "/year",
    error:          "Something went wrong. Please try again.",
  },
  fr: {
    back:           "Retour aux forfaits",
    pageTitle:      "Finaliser votre abonnement",
    summary:        "Résumé de la commande",
    billingMonthly: "Facturé mensuellement — renouvellement automatique",
    billingYearly:  "Facturé annuellement — renouvellement automatique",
    securePayment:  "Paiement sécurisé",
    cancelAnytime:  "Annulation à tout moment",
    support:        "Assistance dédiée",
    autoRenew:      "Renouvellement automatique",
    autoRenewDesc:  "PayPal débite automatiquement votre moyen de paiement à chaque cycle. Vous pouvez annuler à tout moment dans les paramètres de votre compte.",
    preparing:      "Préparation de votre abonnement…",
    redirecting:    "Redirection vers PayPal…",
    btnPayPal:      "Continuer vers PayPal",
    total:          "Total",
    perMonth:       "/mois",
    perYear:        "/an",
    error:          "Une erreur est survenue. Veuillez réessayer.",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  packageId:    number;
  packageName:  string;
  price:        number;
  billingCycle: "monthly" | "yearly";
  lang:         "en" | "fr";
}

export function SubscribeClient({ packageId, packageName, price, billingCycle, lang }: Props) {
  const router = useRouter();

  const [status,   setStatus]   = useState<"idle" | "loading" | "redirecting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const t = T[lang];

  const formattedPrice = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    style: "currency", currency: "CAD", minimumFractionDigits: 2,
  }).format(price);

  const cycleLabel   = billingCycle === "yearly" ? t.perYear   : t.perMonth;
  const billingLabel = billingCycle === "yearly" ? t.billingYearly : t.billingMonthly;

  // Guard: redirect if params are missing
  useEffect(() => {
    if (!packageId || !packageName || !price) {
      router.replace("/dashboard/default");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePayPal() {
    setStatus("loading");
    setErrorMsg("");

    try {
      const token = localStorage.getItem("wtc_consultant_token");
      const res   = await fetch(`${API}/consultant/payment/paypal/subscription/create`, {
        method : "POST",
        headers: {
          Authorization : `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept        : "application/json",
        },
        body: JSON.stringify({
          subscription_package_id: packageId,
          billing_cycle          : billingCycle,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message ?? t.error);
      }

      const approvalUrl: string = json.approval_url;
      if (!approvalUrl) throw new Error(t.error);

      // Persist plan details so the return page can call activate
      sessionStorage.setItem("wtc_paypal_pkg_id",       String(packageId));
      sessionStorage.setItem("wtc_paypal_billing_cycle", billingCycle);

      setStatus("redirecting");
      // Full-page redirect to PayPal — user approves, PayPal sends them to /dashboard/subscribe/return
      window.location.href = approvalUrl;
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : t.error);
      setStatus("error");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">

      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <span className="text-2xl font-black tracking-tight text-white">
          Way<span className="text-blue-400">To</span>Canada
        </span>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white/80 bg-white/10 border border-white/20 hover:bg-white/20 hover:text-white transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.back}
        </button>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-4xl">

          <h1 className="text-3xl font-extrabold text-white text-center mb-8 tracking-tight">
            {t.pageTitle}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-6 items-start">

            {/* ── Left: Plan summary ── */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 text-white space-y-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-blue-300">
                {t.summary}
              </h2>

              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/30 border border-blue-500/40">
                  <CreditCard className="h-6 w-6 text-blue-300" />
                </div>
                <div>
                  <p className="font-bold text-lg leading-tight">{packageName}</p>
                  <p className="text-sm text-white/60">{billingLabel}</p>
                </div>
              </div>

              <div className="border-t border-white/15 pt-4 flex items-end justify-between">
                <span className="text-sm text-white/60">{t.total}</span>
                <div className="text-right">
                  <span className="text-3xl font-extrabold">{formattedPrice}</span>
                  <span className="text-sm text-white/60 ml-1">{cycleLabel}</span>
                </div>
              </div>

              {/* Trust badges */}
              <div className="border-t border-white/15 pt-4 space-y-2.5">
                {[
                  { Icon: Lock,        label: t.securePayment },
                  { Icon: ShieldCheck, label: t.cancelAnytime },
                  { Icon: Zap,         label: t.support },
                  { Icon: RefreshCw,   label: t.autoRenew },
                ].map(({ Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 text-sm text-white/70">
                    <Icon className="h-4 w-4 text-blue-400 shrink-0" />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right: Payment card ── */}
            <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">

              {/* Auto-renewal notice */}
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
                <p className="font-semibold mb-1 flex items-center gap-1.5">
                  <RefreshCw className="h-4 w-4" />
                  {t.autoRenew}
                </p>
                <p className="text-blue-700 leading-relaxed">{t.autoRenewDesc}</p>
              </div>

              {/* Error */}
              {status === "error" && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {errorMsg}
                </div>
              )}

              {/* PayPal button */}
              <button
                onClick={handlePayPal}
                disabled={status === "loading" || status === "redirecting"}
                className="w-full flex items-center justify-center gap-3 h-14 rounded-xl font-bold text-slate-900 bg-[#FFC439] hover:bg-[#f0b528] transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md text-lg"
              >
                {(status === "loading" || status === "redirecting") ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {status === "redirecting" ? t.redirecting : t.preparing}
                  </>
                ) : (
                  <>
                    {/* PayPal wordmark */}
                    <svg viewBox="0 0 101 32" className="h-6" aria-label="PayPal">
                      <path fill="#003087" d="M12.237 2.7H4.437C3.787 2.7 3.237 3.15 3.137 3.8L.037 23.8c-.1.5.3.95.8.95h3.85c.65 0 1.2-.45 1.3-1.1l.8-5.15c.1-.65.65-1.1 1.3-1.1h2.45c5.1 0 8.05-2.5 8.8-7.45.35-2.15 0-3.85-1-5.05-1.1-1.3-3.05-2-5.6-2l-.037-.05z"/>
                      <path fill="#003087" d="M13.087 10.25c-.4 2.65-2.4 2.65-4.35 2.65h-1.1l.75-4.85c.05-.3.3-.5.6-.5h.5c1.3 0 2.55 0 3.2.75.4.45.5 1.1.4 1.95z"/>
                      <path fill="#009cde" d="M32.487 10.15H28.637c-.3 0-.55.2-.6.5l-.15 1-.25-.35c-.75-1.1-2.45-1.45-4.1-1.45-3.85 0-7.1 2.9-7.75 7-.35 2.05.15 4 1.3 5.35 1.05 1.25 2.6 1.8 4.4 1.8 3.1 0 4.85-2 4.85-2l-.15 1c-.1.5.3.95.8.95h3.45c.65 0 1.2-.45 1.3-1.1l2.05-13.1c.1-.5-.3-.65-.8-.65l.037.05z"/>
                    </svg>
                    {t.btnPayPal}
                    <ExternalLink className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Lock className="h-3 w-3" />
                256-bit SSL · Your card is saved securely by PayPal
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}


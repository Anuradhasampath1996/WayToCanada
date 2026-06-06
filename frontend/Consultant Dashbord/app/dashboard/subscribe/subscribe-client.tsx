"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paypal?: any;
  }
}

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// i18n
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const T = {
  en: {
    back:            "Back to Plans",
    pageTitle:       "Complete Your Subscription",
    summary:         "Order Summary",
    billingMonthly:  "Billed monthly â€” auto-renews every month",
    billingYearly:   "Billed annually â€” auto-renews every year",
    securePayment:   "Secure Payment",
    cancelAnytime:   "Cancel Anytime",
    support:         "Dedicated Support",
    autoRenew:       "Auto-Renewal",
    autoRenewDesc:   "Your payment method will be charged each cycle. You can cancel any time from your account settings.",
    preparing:       "Preparing your subscriptionâ€¦",
    redirecting:     "Redirecting to PayPalâ€¦",
    processing:      "Processing paymentâ€¦",
    btnPayPal:       "Continue to PayPal",
    tabPayPal:       "PayPal",
    tabCard:         "Credit / Debit Card",
    total:           "Total",
    perMonth:        "/month",
    perYear:         "/year",
    error:           "Something went wrong. Please try again.",
    successTitle:    "Subscription Activated!",
    successDesc:     "Your subscription is now active. Redirecting to your dashboardâ€¦",
    cardLoadingSDK:  "Loading secure payment formâ€¦",
    cardAccepted:    "We accept Visa, Mastercard, Amex and more",
    cardPowered:     "Card payments powered by PayPal",
  },
  fr: {
    back:            "Retour aux forfaits",
    pageTitle:       "Finaliser votre abonnement",
    summary:         "RÃ©sumÃ© de la commande",
    billingMonthly:  "FacturÃ© mensuellement â€” renouvellement automatique",
    billingYearly:   "FacturÃ© annuellement â€” renouvellement automatique",
    securePayment:   "Paiement sÃ©curisÃ©",
    cancelAnytime:   "Annulation Ã  tout moment",
    support:         "Assistance dÃ©diÃ©e",
    autoRenew:       "Renouvellement automatique",
    autoRenewDesc:   "Votre moyen de paiement sera dÃ©bitÃ© Ã  chaque cycle. Vous pouvez annuler Ã  tout moment.",
    preparing:       "PrÃ©paration de votre abonnementâ€¦",
    redirecting:     "Redirection vers PayPalâ€¦",
    processing:      "Traitement du paiementâ€¦",
    btnPayPal:       "Continuer vers PayPal",
    tabPayPal:       "PayPal",
    tabCard:         "Carte bancaire",
    total:           "Total",
    perMonth:        "/mois",
    perYear:         "/an",
    error:           "Une erreur est survenue. Veuillez rÃ©essayer.",
    successTitle:    "Abonnement activÃ© !",
    successDesc:     "Votre abonnement est maintenant actif. Redirection vers votre tableau de bordâ€¦",
    cardLoadingSDK:  "Chargement du formulaire de paiement sÃ©curisÃ©â€¦",
    cardAccepted:    "Nous acceptons Visa, Mastercard, Amex et plus",
    cardPowered:     "Paiements par carte via PayPal",
  },
} as const;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Props {
  packageId:    number;
  packageName:  string;
  price:        number;
  billingCycle: "monthly" | "yearly";
  lang:         "en" | "fr";
}

export function SubscribeClient({ packageId, packageName, price, billingCycle, lang }: Props) {
  const router = useRouter();
  const t = T[lang];

  const [tab,      setTab]      = useState<"paypal" | "card">("card");
  const [status,   setStatus]   = useState<"idle" | "loading" | "redirecting" | "processing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // SDK loading state
  const [sdkReady,  setSdkReady]  = useState(false);
  const [sdkError,  setSdkError]  = useState("");
  const cardRendered = useRef(false);

  const formattedPrice = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    style: "currency", currency: "CAD", minimumFractionDigits: 2,
  }).format(price);

  const cycleLabel   = billingCycle === "yearly" ? t.perYear   : t.perMonth;
  const billingLabel = billingCycle === "yearly" ? t.billingYearly : t.billingMonthly;

  const token = () => localStorage.getItem("wtc_consultant_token") ?? "";

  // Guard: redirect if params are missing
  useEffect(() => {
    if (!packageId || !packageName || !price) {
      router.replace("/dashboard/default");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load PayPal SDK on mount (needed for card payments)
  useEffect(() => {
    async function loadSdk() {
      try {
        const res  = await fetch(`${API}/consultant/payment/paypal/config`, {
          headers: { Authorization: `Bearer ${token()}`, Accept: "application/json" },
        });
        const cfg  = await res.json();
        const cid: string = cfg.client_id;

        if (!cid) throw new Error("Missing PayPal client_id");

        // Avoid loading the script twice
        if (document.getElementById("paypal-sdk")) { setSdkReady(true); return; }

        const script       = document.createElement("script");
        script.id          = "paypal-sdk";
        script.src         = `https://www.paypal.com/sdk/js?client-id=${cid}&currency=CAD&intent=capture&components=buttons`;
        script.onload      = () => setSdkReady(true);
        script.onerror     = () => setSdkError(t.error);
        document.body.appendChild(script);
      } catch {
        setSdkError(t.error);
      }
    }
    loadSdk();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Render PayPal CARD button when SDK is ready and card tab is active
  useEffect(() => {
    if (!sdkReady || tab !== "card" || cardRendered.current) return;
    if (!window.paypal) return;

    cardRendered.current = true;

    window.paypal.Buttons({
      fundingSource: window.paypal.FUNDING.CARD,
      style: {
        shape:  "rect",
        layout: "vertical",
        label:  "pay",
        color:  "black",
      },

      createOrder: async () => {
        setStatus("processing");
        setErrorMsg("");
        const res  = await fetch(`${API}/consultant/payment/paypal/create-order`, {
          method : "POST",
          headers: {
            Authorization : `Bearer ${token()}`,
            "Content-Type": "application/json",
            Accept        : "application/json",
          },
          body: JSON.stringify({
            subscription_package_id: packageId,
            billing_cycle          : billingCycle,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? t.error);
        return json.order_id as string;
      },

      onApprove: async (data: { orderID: string }) => {
        setStatus("processing");
        const res  = await fetch(`${API}/consultant/payment/paypal/capture-order`, {
          method : "POST",
          headers: {
            Authorization : `Bearer ${token()}`,
            "Content-Type": "application/json",
            Accept        : "application/json",
          },
          body: JSON.stringify({
            order_id                : data.orderID,
            subscription_package_id : packageId,
            billing_cycle           : billingCycle,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? t.error);
        setStatus("success");
        setTimeout(() => router.replace("/consultantdashboard"), 3000);
      },

      onError: (err: Error) => {
        setErrorMsg(err?.message ?? t.error);
        setStatus("error");
        cardRendered.current = false; // allow re-render after error
      },

      onCancel: () => {
        setStatus("idle");
        cardRendered.current = false;
      },
    }).render("#paypal-card-container");
  }, [sdkReady, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€â”€ PayPal redirect (subscription) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function handlePayPal() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res  = await fetch(`${API}/consultant/payment/paypal/subscription/create`, {
        method : "POST",
        headers: {
          Authorization : `Bearer ${token()}`,
          "Content-Type": "application/json",
          Accept        : "application/json",
        },
        body: JSON.stringify({
          subscription_package_id: packageId,
          billing_cycle          : billingCycle,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? t.error);

      const approvalUrl: string = json.approval_url;
      if (!approvalUrl) throw new Error(t.error);

      sessionStorage.setItem("wtc_paypal_pkg_id",        String(packageId));
      sessionStorage.setItem("wtc_paypal_billing_cycle",  billingCycle);

      setStatus("redirecting");
      window.location.href = approvalUrl;
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : t.error);
      setStatus("error");
    }
  }

  // â”€â”€â”€ Success screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center space-y-5">
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">{t.successTitle}</h2>
          <p className="text-slate-500 text-sm">{t.successDesc}</p>
          <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">

      {/* â”€â”€ Top bar â”€â”€ */}
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

      {/* â”€â”€ Main â”€â”€ */}
      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-4xl">

          <h1 className="text-3xl font-extrabold text-white text-center mb-8 tracking-tight">
            {t.pageTitle}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-6 items-start">

            {/* â”€â”€ Left: Plan summary â”€â”€ */}
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

            {/* â”€â”€ Right: Payment card â”€â”€ */}
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

              {/* Payment method tabs */}
              <div className="flex border-b border-slate-200">
                <button
                  onClick={() => setTab("paypal")}
                  className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                    tab === "paypal"
                      ? "bg-white text-slate-900 border-b-2 border-blue-600"
                      : "bg-slate-50 text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {/* PayPal wordmark */}
                  <svg viewBox="0 0 80 20" className="h-4" aria-hidden="true">
                    <text x="0" y="16" fontFamily="Arial" fontWeight="bold" fontSize="16" fill="#003087">Pay</text>
                    <text x="29" y="16" fontFamily="Arial" fontWeight="bold" fontSize="16" fill="#009cde">Pal</text>
                  </svg>
                  {t.tabPayPal}
                </button>
                <button
                  onClick={() => setTab("card")}
                  className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                    tab === "card"
                      ? "bg-white text-slate-900 border-b-2 border-blue-600"
                      : "bg-slate-50 text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  {t.tabCard}
                </button>
              </div>

              <div className="p-8 space-y-6">

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

                {/* â”€â”€ PayPal tab â”€â”€ */}
                {tab === "paypal" && (
                  <div className="space-y-4">
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
                    <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                      <Lock className="h-3 w-3" />
                      Redirects to PayPal â€” supports auto-renewal billing
                    </p>
                  </div>
                )}

                {/* â”€â”€ Card tab â”€â”€ */}
                {tab === "card" && (
                  <div className="space-y-4">

                    {/* Card brand icons */}
                    <div className="flex items-center gap-2">
                      {/* Visa */}
                      <svg viewBox="0 0 38 24" className="h-7 w-11 rounded border border-slate-200 bg-white p-0.5" aria-label="Visa">
                        <rect width="38" height="24" rx="3" fill="#1A1F71"/>
                        <text x="7" y="17" fontSize="13" fontWeight="bold" fill="white" fontFamily="Arial">VISA</text>
                      </svg>
                      {/* Mastercard */}
                      <svg viewBox="0 0 38 24" className="h-7 w-11 rounded border border-slate-200" aria-label="Mastercard">
                        <rect width="38" height="24" rx="3" fill="white"/>
                        <circle cx="14" cy="12" r="8" fill="#EB001B"/>
                        <circle cx="24" cy="12" r="8" fill="#F79E1B"/>
                        <path d="M19 6.8a8 8 0 0 1 0 10.4A8 8 0 0 1 19 6.8z" fill="#FF5F00"/>
                      </svg>
                      {/* Amex */}
                      <svg viewBox="0 0 38 24" className="h-7 w-11 rounded border border-slate-200 bg-[#2E77BC] p-0.5" aria-label="American Express">
                        <rect width="38" height="24" rx="3" fill="#2E77BC"/>
                        <text x="4" y="16" fontSize="9" fontWeight="bold" fill="white" fontFamily="Arial">AMEX</text>
                      </svg>
                      <span className="text-xs text-slate-400 ml-1">{t.cardAccepted}</span>
                    </div>

                    {/* PayPal SDK card button container */}
                    {sdkError ? (
                      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                        {sdkError}
                      </div>
                    ) : !sdkReady ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {t.cardLoadingSDK}
                      </div>
                    ) : (
                      <div>
                        {status === "processing" && (
                          <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t.processing}
                          </div>
                        )}
                        {/* PayPal injects the card button here */}
                        <div id="paypal-card-container" />
                      </div>
                    )}

                    <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                      <Lock className="h-3 w-3" />
                      {t.cardPowered}
                    </p>
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

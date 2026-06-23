"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

const T = {
  en: {
    back:            "Back to Plans",
    pageTitle:       "Complete Your Subscription",
    summary:         "Order Summary",
    billingMonthly:  "Billed monthly — auto-renews every month",
    billingYearly:   "Billed annually — auto-renews every year",
    securePayment:   "Secure Payment",
    cancelAnytime:   "Cancel Anytime",
    support:         "Dedicated Support",
    autoRenew:       "Auto-Renewal",
    autoRenewDesc:   "Your payment method will be charged each cycle. You can cancel any time from your account settings.",
    preparing:       "Preparing checkout…",
    redirecting:     "Redirecting to Stripe…",
    btnStripe:       "Continue to Stripe",
    total:           "Total",
    subtotal:        "Subtotal",
    salesTax:        "Sales tax",
    province:        "Place of supply (province)",
    provinceHint:    "Tax rate is based on CRA place-of-supply rules for your province.",
    selectProvince:  "Select your province",
    billingAddress:  "Billing address",
    country:         "Country",
    addressLine1:    "Street address",
    addressLine2:    "Apartment, suite (optional)",
    city:            "City",
    postalCode:      "Postal / ZIP code",
    outsideCanada:   "No Canadian sales tax — recipient located outside Canada.",
    canadaOnlyTax:   "Canadian GST/HST applies based on your province of supply.",
    perMonth:        "/month",
    perYear:         "/year",
    error:           "Something went wrong. Please try again.",
    successTitle:    "Subscription Activated!",
    successDesc:     "Your subscription is now active. Redirecting to your dashboard…",
    cardAccepted:    "We accept Visa, Mastercard, Amex and more",
    stripePowered:   "Payments secured by Stripe",
  },
  fr: {
    back:            "Retour aux forfaits",
    pageTitle:       "Finaliser votre abonnement",
    summary:         "Résumé de la commande",
    billingMonthly:  "Facturé mensuellement — renouvellement automatique",
    billingYearly:   "Facturé annuellement — renouvellement automatique",
    securePayment:   "Paiement sécurisé",
    cancelAnytime:   "Annulation à tout moment",
    support:         "Assistance dédiée",
    autoRenew:       "Renouvellement automatique",
    autoRenewDesc:   "Votre moyen de paiement sera débité à chaque cycle. Vous pouvez annuler à tout moment.",
    preparing:       "Préparation du paiement…",
    redirecting:     "Redirection vers Stripe…",
    btnStripe:       "Continuer vers Stripe",
    total:           "Total",
    subtotal:        "Sous-total",
    salesTax:        "Taxe de vente",
    province:        "Lieu de fourniture (province)",
    provinceHint:    "Le taux de taxe est basé sur les règles de l'ARC pour votre province.",
    selectProvince:  "Sélectionnez votre province",
    billingAddress:  "Adresse de facturation",
    country:         "Pays",
    addressLine1:    "Adresse",
    addressLine2:    "Appartement, bureau (optionnel)",
    city:            "Ville",
    postalCode:      "Code postal",
    outsideCanada:   "Pas de taxe de vente canadienne — destinataire hors Canada.",
    canadaOnlyTax:   "La TPS/TVH canadienne s'applique selon votre province de fourniture.",
    perMonth:        "/mois",
    perYear:         "/an",
    error:           "Une erreur est survenue. Veuillez réessayer.",
    successTitle:    "Abonnement activé !",
    successDesc:     "Votre abonnement est maintenant actif. Redirection vers votre tableau de bord…",
    cardAccepted:    "Nous acceptons Visa, Mastercard, Amex et plus",
    stripePowered:   "Paiements sécurisés par Stripe",
  },
} as const;

type ProvinceOption = { code: string; name: string; label: string };

type TaxBreakdown = {
  province_name: string;
  tax_label: string;
  subtotal: number;
  total_tax: number;
  total: number;
  total_rate_pct: number;
};

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

  const [status,      setStatus]      = useState<"idle" | "loading" | "redirecting" | "success" | "error">("idle");
  const [errorMsg,    setErrorMsg]    = useState("");
  const [provinces,   setProvinces]   = useState<ProvinceOption[]>([]);
  const [province,    setProvince]    = useState("");
  const [billingCountry, setBillingCountry] = useState("CA");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [tax,         setTax]         = useState<TaxBreakdown | null>(null);
  const [taxLoading,  setTaxLoading]  = useState(false);

  const fmt = (amount: number) =>
    new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
      style: "currency", currency: "CAD", minimumFractionDigits: 2,
    }).format(amount);

  const formattedPrice = fmt(price);

  const cycleLabel   = billingCycle === "yearly" ? t.perYear   : t.perMonth;
  const billingLabel = billingCycle === "yearly" ? t.billingYearly : t.billingMonthly;

  const token = () => localStorage.getItem("wtc_consultant_token") ?? "";

  useEffect(() => {
    if (!packageId || !packageName || !price) {
      router.replace("/dashboard/default");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    async function loadProvincesAndProfile() {
      try {
        const [ratesRes, profileRes] = await Promise.all([
          fetch(`${API}/tax/gst-hst/rates`, { headers: { Accept: "application/json" } }),
          fetch(`${API}/consultant/profile`, {
            headers: { Authorization: `Bearer ${token()}`, Accept: "application/json" },
          }),
        ]);

        const ratesJson = ratesRes.ok ? await ratesRes.json() : null;
        const profileJson = profileRes.ok ? await profileRes.json() : null;

        if (cancelled) return;

        const opts: ProvinceOption[] = ratesJson?.provinces ?? [];
        setProvinces(opts);

        const fromProfile = profileJson?.company_province ?? "";
        if (fromProfile) {
          const match = opts.find(
            (p) => p.code === fromProfile.toUpperCase() || p.name.toLowerCase() === fromProfile.toLowerCase()
          );
          setProvince(match?.code ?? fromProfile);
        } else if (opts.length > 0) {
          setProvince(opts.find((p) => p.code === "ON")?.code ?? opts[0].code);
        }

        if (profileJson) {
          setBillingCountry(profileJson.company_country === "Canada" || profileJson.company_country === "CA" ? "CA" : (profileJson.company_country ?? "CA"));
          setAddressLine1(profileJson.company_address_line1 ?? "");
          setAddressLine2(profileJson.company_address_line2 ?? "");
          setCity(profileJson.company_city ?? "");
          setPostalCode(profileJson.company_postal_code ?? "");
        }
      } catch {
        /* province list optional — checkout still works */
      }
    }

    void loadProvincesAndProfile();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isCanada = billingCountry === "CA";

  const billingPayload = useCallback(() => ({
    subscription_package_id: packageId,
    billing_cycle: billingCycle,
    billing_country: billingCountry,
    billing_address_line1: addressLine1.trim(),
    billing_address_line2: addressLine2.trim() || undefined,
    billing_city: city.trim(),
    billing_postal_code: postalCode.trim() || undefined,
    billing_province: isCanada ? province : undefined,
    province: isCanada ? province : undefined,
  }), [packageId, billingCycle, billingCountry, addressLine1, addressLine2, city, postalCode, province, isCanada]);

  const fetchTaxQuote = useCallback(async () => {
    if (!packageId || !addressLine1.trim() || !city.trim()) return;
    if (isCanada && !province) return;
    setTaxLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(billingPayload()).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.set(k, String(v));
      });
      const res = await fetch(`${API}/consultant/payment/stripe/tax-quote?${params}`, {
        headers: { Authorization: `Bearer ${token()}`, Accept: "application/json" },
      });
      const json = await res.json();
      if (res.ok && json.tax) {
        setTax(json.tax);
      } else {
        setTax(null);
      }
    } catch {
      setTax(null);
    } finally {
      setTaxLoading(false);
    }
  }, [billingPayload, packageId, isCanada]);

  useEffect(() => {
    void fetchTaxQuote();
  }, [fetchTaxQuote]);

  async function handleStripeCheckout() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`${API}/consultant/payment/stripe/checkout-session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token()}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(billingPayload()),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? t.error);

      const checkoutUrl: string = json.url;
      if (!checkoutUrl) throw new Error(t.error);

      setStatus("redirecting");
      window.location.href = checkoutUrl;
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : t.error);
      setStatus("error");
    }
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <span className="text-2xl font-black tracking-tight text-white">
          RCIC<span className="text-blue-400">MASTER</span>
        </span>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white/80 bg-white/10 border border-white/20 hover:bg-white/20 hover:text-white transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.back}
        </button>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-4xl">
          <h1 className="text-3xl font-extrabold text-white text-center mb-8 tracking-tight">
            {t.pageTitle}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-6 items-start">
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

              <div className="border-t border-white/15 pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">{t.subtotal}</span>
                  <span className="font-semibold">{formattedPrice}{cycleLabel}</span>
                </div>
                {taxLoading ? (
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    …
                  </div>
                ) : tax ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">
                      {t.salesTax} ({tax.tax_label})
                    </span>
                    <span className="font-semibold">{fmt(tax.total_tax)}</span>
                  </div>
                ) : null}
                <div className="flex items-end justify-between pt-1 border-t border-white/10">
                  <span className="text-sm text-white/60">{t.total}</span>
                  <div className="text-right">
                    <span className="text-3xl font-extrabold">
                      {fmt(tax?.total ?? price)}
                    </span>
                    <span className="text-sm text-white/60 ml-1">{cycleLabel}</span>
                  </div>
                </div>
              </div>

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

            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-8 space-y-6">
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
                  <p className="font-semibold mb-1 flex items-center gap-1.5">
                    <RefreshCw className="h-4 w-4" />
                    {t.autoRenew}
                  </p>
                  <p className="text-blue-700 leading-relaxed">{t.autoRenewDesc}</p>
                </div>

                {status === "error" && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-4">
                  <p className="text-sm font-semibold text-slate-700">{t.billingAddress}</p>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">{t.country}</label>
                    <Select value={billingCountry} onValueChange={setBillingCountry}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="IN">India</SelectItem>
                        <SelectItem value="OTHER">Outside Canada (other)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-400">
                      {isCanada ? t.canadaOnlyTax : t.outsideCanada}
                    </p>
                  </div>

                  <Input placeholder={t.addressLine1} value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
                  <Input placeholder={t.addressLine2} value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder={t.city} value={city} onChange={(e) => setCity(e.target.value)} />
                    <Input placeholder={t.postalCode} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                  </div>

                  {isCanada && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-slate-500" />
                        {t.province}
                      </label>
                      <Select value={province} onValueChange={setProvince} disabled={provinces.length === 0}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t.selectProvince} />
                        </SelectTrigger>
                        <SelectContent>
                          {provinces.map((p) => (
                            <SelectItem key={p.code} value={p.code}>
                              {p.name} — {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-400">{t.provinceHint}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 38 24" className="h-7 w-11 rounded border border-slate-200 bg-white p-0.5" aria-label="Visa">
                      <rect width="38" height="24" rx="3" fill="#1A1F71"/>
                      <text x="7" y="17" fontSize="13" fontWeight="bold" fill="white" fontFamily="Arial">VISA</text>
                    </svg>
                    <svg viewBox="0 0 38 24" className="h-7 w-11 rounded border border-slate-200" aria-label="Mastercard">
                      <rect width="38" height="24" rx="3" fill="white"/>
                      <circle cx="14" cy="12" r="8" fill="#EB001B"/>
                      <circle cx="24" cy="12" r="8" fill="#F79E1B"/>
                      <path d="M19 6.8a8 8 0 0 1 0 10.4A8 8 0 0 1 19 6.8z" fill="#FF5F00"/>
                    </svg>
                    <svg viewBox="0 0 38 24" className="h-7 w-11 rounded border border-slate-200 bg-[#2E77BC] p-0.5" aria-label="American Express">
                      <rect width="38" height="24" rx="3" fill="#2E77BC"/>
                      <text x="4" y="16" fontSize="9" fontWeight="bold" fill="white" fontFamily="Arial">AMEX</text>
                    </svg>
                    <span className="text-xs text-slate-400 ml-1">{t.cardAccepted}</span>
                  </div>

                  <button
                    onClick={handleStripeCheckout}
                    disabled={status === "loading" || status === "redirecting" || !addressLine1.trim() || !city.trim() || (isCanada && !province) || taxLoading}
                    className="w-full flex items-center justify-center gap-3 h-14 rounded-xl font-bold text-white bg-[#635BFF] hover:bg-[#5851e6] transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md text-lg"
                  >
                    {(status === "loading" || status === "redirecting") ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {status === "redirecting" ? t.redirecting : t.preparing}
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 60 25" className="h-5 w-auto" aria-hidden="true">
                          <path fill="white" d="M59.64 14.28h-8.06c0 1.87-1.15 3.2-3.4 3.2-2.17 0-3.53-1.28-3.53-3.36 0-2.24 1.44-3.48 4.12-3.48h2.17v-2.02h-2.25c-3.48 0-5.63 1.84-5.63 5.12 0 3.12 2.05 5.04 5.79 5.04 3.87 0 5.79-2.36 5.79-5.5v-1.0zM6.97 20.3C3.1 20.3.9 17.8.9 14.08c0-3.8 2.3-6.22 6.07-6.22 3.79 0 6.07 2.42 6.07 6.22 0 3.72-2.28 6.22-6.07 6.22zm0-2.02c2.33 0 3.72-1.6 3.72-4.2 0-2.62-1.39-4.2-3.72-4.2-2.31 0-3.72 1.58-3.72 4.2 0 2.6 1.41 4.2 3.72 4.2z"/>
                        </svg>
                        {t.btnStripe}
                        <ExternalLink className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    {t.stripePowered}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

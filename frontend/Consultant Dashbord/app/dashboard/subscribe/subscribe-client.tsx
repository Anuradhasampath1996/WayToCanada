"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
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
    back: "Back",
    pageTitle: "Checkout",
    summary: "Order summary",
    billingMonthly: "Billed monthly",
    billingYearly: "Billed yearly",
    preparing: "Preparing checkout…",
    redirecting: "Redirecting to Stripe…",
    btnStripe: "Pay with Stripe",
    total: "Total",
    subtotal: "Subtotal",
    salesTax: "Tax",
    province: "Province",
    selectProvince: "Select province",
    billingAddress: "Billing address",
    country: "Country",
    addressLine1: "Street address",
    addressLine2: "Apt / suite (optional)",
    city: "City",
    postalCode: "Postal code",
    outsideCanada: "No Canadian sales tax outside Canada.",
    canadaOnlyTax: "GST/HST based on province of supply.",
    perMonth: "/mo",
    perYear: "/yr",
    error: "Something went wrong. Please try again.",
    successTitle: "Subscription activated",
    successDesc: "Redirecting to your dashboard…",
    stripePowered: "Secure payment by Stripe",
    requiredHint: "Address and city are required.",
  },
  fr: {
    back: "Retour",
    pageTitle: "Paiement",
    summary: "Résumé",
    billingMonthly: "Facturation mensuelle",
    billingYearly: "Facturation annuelle",
    preparing: "Préparation…",
    redirecting: "Redirection vers Stripe…",
    btnStripe: "Payer avec Stripe",
    total: "Total",
    subtotal: "Sous-total",
    salesTax: "Taxe",
    province: "Province",
    selectProvince: "Choisir la province",
    billingAddress: "Adresse de facturation",
    country: "Pays",
    addressLine1: "Adresse",
    addressLine2: "App. / bureau (optionnel)",
    city: "Ville",
    postalCode: "Code postal",
    outsideCanada: "Pas de taxe canadienne hors Canada.",
    canadaOnlyTax: "TPS/TVH selon la province de fourniture.",
    perMonth: "/mois",
    perYear: "/an",
    error: "Une erreur est survenue. Veuillez réessayer.",
    successTitle: "Abonnement activé",
    successDesc: "Redirection vers le tableau de bord…",
    stripePowered: "Paiement sécurisé par Stripe",
    requiredHint: "Adresse et ville requises.",
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
  packageId: number;
  packageName: string;
  price: number;
  billingCycle: "monthly" | "yearly";
  lang: "en" | "fr";
}

export function SubscribeClient({ packageId, packageName, price, billingCycle, lang }: Props) {
  const router = useRouter();
  const t = T[lang];

  const [status, setStatus] = useState<"idle" | "loading" | "redirecting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [province, setProvince] = useState("");
  const [billingCountry, setBillingCountry] = useState("CA");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [tax, setTax] = useState<TaxBreakdown | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);

  const fmt = (amount: number) =>
    new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 2,
    }).format(amount);

  const cycleLabel = billingCycle === "yearly" ? t.perYear : t.perMonth;
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
          setBillingCountry(
            profileJson.company_country === "Canada" || profileJson.company_country === "CA"
              ? "CA"
              : (profileJson.company_country ?? "CA")
          );
          setAddressLine1(profileJson.company_address_line1 ?? "");
          setAddressLine2(profileJson.company_address_line2 ?? "");
          setCity(profileJson.company_city ?? "");
          setPostalCode(profileJson.company_postal_code ?? "");
        }
      } catch {
        /* optional */
      }
    }

    void loadProvincesAndProfile();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isCanada = billingCountry === "CA";

  const billingPayload = useCallback(
    () => ({
      subscription_package_id: packageId,
      billing_cycle: billingCycle,
      billing_country: billingCountry,
      billing_address_line1: addressLine1.trim(),
      billing_address_line2: addressLine2.trim() || undefined,
      billing_city: city.trim(),
      billing_postal_code: postalCode.trim() || undefined,
      billing_province: isCanada ? province : undefined,
      province: isCanada ? province : undefined,
    }),
    [packageId, billingCycle, billingCountry, addressLine1, addressLine2, city, postalCode, province, isCanada]
  );

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
  }, [billingPayload, packageId, isCanada, addressLine1, city, province]);

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

  const canPay =
    status !== "loading" &&
    status !== "redirecting" &&
    !!addressLine1.trim() &&
    !!city.trim() &&
    (!isCanada || !!province) &&
    !taxLoading;

  if (status === "success") {
    return (
      <div className="ck-root ck-page">
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&display=swap"
        />
        <style>{CK_CSS}</style>
        <div className="ck-success">
          <CheckCircle2 className="h-14 w-14 text-[#D01D20]" />
          <h2>{t.successTitle}</h2>
          <p>{t.successDesc}</p>
          <Loader2 className="h-5 w-5 animate-spin text-[#D01D20]" />
        </div>
      </div>
    );
  }

  return (
    <div className="ck-root ck-page">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&display=swap"
      />
      <style>{CK_CSS}</style>

      <header className="ck-header">
        <div className="ck-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/rcicmaster-logo.png" alt="RCICMASTER" />
        </div>
        <button type="button" className="ck-back" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          {t.back}
        </button>
      </header>

      <main className="ck-main">
        <h1 className="ck-title">{t.pageTitle}</h1>

        <div className="ck-grid">
          {/* Order summary — solid, high contrast */}
          <aside className="ck-summary">
            <p className="ck-kicker">{t.summary}</p>
            <div className="ck-plan">
              <strong>{packageName}</strong>
              <span>{billingLabel}</span>
            </div>

            <div className="ck-lines">
              <div className="ck-line">
                <span>{t.subtotal}</span>
                <span>{fmt(price)}</span>
              </div>
              {taxLoading ? (
                <div className="ck-line ck-line--muted">
                  <span>{t.salesTax}</span>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </div>
              ) : tax ? (
                <div className="ck-line">
                  <span>
                    {t.salesTax}
                    {tax.tax_label ? ` (${tax.tax_label})` : ""}
                  </span>
                  <span>{fmt(tax.total_tax)}</span>
                </div>
              ) : null}
              <div className="ck-total">
                <span>{t.total}</span>
                <div>
                  <strong>{fmt(tax?.total ?? price)}</strong>
                  <em>{cycleLabel}</em>
                </div>
              </div>
            </div>

            <p className="ck-secure">
              <Lock className="h-3.5 w-3.5" />
              {t.stripePowered}
            </p>
          </aside>

          {/* Billing form */}
          <section className="ck-form">
            {status === "error" && errorMsg ? (
              <div className="ck-error" role="alert">
                {errorMsg}
              </div>
            ) : null}

            <h2>{t.billingAddress}</h2>

            <div className="ck-field">
              <label>{t.country}</label>
              <Select value={billingCountry} onValueChange={setBillingCountry}>
                <SelectTrigger className="w-full h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                  <SelectItem value="IN">India</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
              <p className="ck-hint">{isCanada ? t.canadaOnlyTax : t.outsideCanada}</p>
            </div>

            <Input
              className="h-11"
              placeholder={t.addressLine1}
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
            />
            <Input
              className="h-11"
              placeholder={t.addressLine2}
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
            />
            <div className="ck-row">
              <Input
                className="h-11"
                placeholder={t.city}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <Input
                className="h-11"
                placeholder={t.postalCode}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>

            {isCanada ? (
              <div className="ck-field">
                <label>
                  <MapPin className="h-3.5 w-3.5" />
                  {t.province}
                </label>
                <Select value={province} onValueChange={setProvince} disabled={provinces.length === 0}>
                  <SelectTrigger className="w-full h-11">
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
              </div>
            ) : null}

            <div className="ck-cards">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/payments/visa.png" alt="Visa" className="ck-card-img" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/payments/mastercard.png" alt="Mastercard" className="ck-card-img" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/payments/amex.png" alt="American Express" className="ck-card-img" />
            </div>

            <button type="button" className="ck-pay" onClick={handleStripeCheckout} disabled={!canPay}>
              {status === "loading" || status === "redirecting" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {status === "redirecting" ? t.redirecting : t.preparing}
                </>
              ) : (
                <>
                  {t.btnStripe}
                  <ExternalLink className="h-4 w-4" />
                </>
              )}
            </button>

            {!canPay && status === "idle" ? <p className="ck-hint ck-hint--center">{t.requiredHint}</p> : null}
          </section>
        </div>
      </main>
    </div>
  );
}

const CK_CSS = `
.ck-root {
  --red: #d01d20;
  --red-dark: #b0181b;
  --ink: #111318;
  --muted: #667085;
  --line: #e6e8ee;
  --soft: #f6f7f9;
  --white: #fff;
  font-family: Manrope, "Segoe UI", sans-serif;
  color: var(--ink);
}
.ck-root *, .ck-root *::before, .ck-root *::after { box-sizing: border-box; }

.ck-page {
  min-height: 100vh;
  background:
    radial-gradient(ellipse 70% 45% at 50% -15%, rgba(208, 29, 32, 0.07), transparent 55%),
    linear-gradient(180deg, #fafbfc 0%, #eef1f5 100%);
}

.ck-header {
  max-width: 920px;
  margin: 0 auto;
  padding: 1.25rem 1.25rem 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.ck-logo {
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 0.75rem;
  border-radius: 12px;
  background: var(--white);
  border: 1px solid var(--line);
  box-shadow: 0 4px 14px rgba(17, 19, 24, 0.05);
}

.ck-logo img {
  height: 32px;
  width: auto;
  display: block;
  object-fit: contain;
}

.ck-back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid var(--line);
  background: var(--white);
  color: var(--muted);
  font: 600 0.8rem/1 Manrope, sans-serif;
  padding: 0.55rem 0.9rem;
  border-radius: 999px;
  cursor: pointer;
}
.ck-back:hover { color: var(--ink); }

.ck-main {
  max-width: 920px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 2.5rem;
}

.ck-title {
  margin: 0 0 1.35rem;
  text-align: center;
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.ck-grid {
  display: grid;
  gap: 1.15rem;
  grid-template-columns: 1fr;
  align-items: start;
}

@media (min-width: 860px) {
  .ck-grid {
    grid-template-columns: 0.95fr 1.15fr;
    gap: 1.25rem;
  }
}

.ck-summary {
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 1.35rem 1.35rem 1.2rem;
  box-shadow: 0 10px 30px rgba(17, 19, 24, 0.05);
}

.ck-kicker {
  margin: 0 0 0.85rem;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--red);
}

.ck-plan {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--line);
}

.ck-plan strong {
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.ck-plan span {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}

.ck-lines {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 1rem 0;
}

.ck-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink);
}

.ck-line span:first-child,
.ck-line--muted {
  color: var(--muted);
  font-weight: 600;
}

.ck-total {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.35rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--line);
}

.ck-total > span {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ink);
}

.ck-total strong {
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--ink);
}

.ck-total em {
  font-style: normal;
  margin-left: 0.25rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}

.ck-secure {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted);
}

.ck-secure svg { color: var(--red); }

.ck-form {
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 1.35rem 1.35rem 1.45rem;
  box-shadow: 0 10px 30px rgba(17, 19, 24, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ck-form h2 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.ck-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.ck-field label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--ink);
}

.ck-hint {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--muted);
  line-height: 1.4;
}

.ck-hint--center { text-align: center; }

.ck-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}

.ck-cards {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.35rem;
}

.ck-card-img {
  height: 28px;
  width: auto;
  display: block;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid var(--line);
  background: #fff;
  padding: 2px 4px;
}

.ck-pay {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 48px;
  margin-top: 0.35rem;
  border: 0;
  border-radius: 12px;
  background: var(--red);
  color: #fff;
  font: 700 0.95rem/1 Manrope, sans-serif;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(208, 29, 32, 0.25);
  transition: background 0.15s;
}

.ck-pay:hover:not(:disabled) { background: var(--red-dark); }
.ck-pay:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

.ck-error {
  padding: 0.75rem 0.9rem;
  border-radius: 10px;
  border: 1px solid rgba(208, 29, 32, 0.25);
  background: rgba(208, 29, 32, 0.06);
  color: var(--red-dark);
  font-size: 0.85rem;
  font-weight: 600;
}

.ck-success {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  text-align: center;
  padding: 2rem;
}

.ck-success h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
}

.ck-success p {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}
`;

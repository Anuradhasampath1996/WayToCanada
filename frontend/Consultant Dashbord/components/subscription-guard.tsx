"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Loader2,
  Lock,
  LogOut,
  ShieldCheck,
} from "lucide-react";

import { CONSULTANT_LOGIN_URL } from "@/lib/auth-urls";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

const strings = {
  en: {
    badgeActive: "Subscription required",
    trustSecure: "Secure checkout",
    trustCancel: "Cancel anytime",
    trustSupport: "Canadian support",
    monthly: "Monthly",
    yearly: "Yearly",
    saveLabel: "Save ~20%",
    perMonth: "/month",
    perYear: "/year",
    trialAvailable: (days: number) => `${days}-day free trial`,
    trialUsed: "Trial already used",
    trialBtn: (days: number) => `Start ${days}-day trial`,
    subscribeMonthly: "Continue with monthly",
    subscribeYearly: "Continue with yearly",
    mostPopular: "Recommended",
    choosePlan: "Choose a plan",
    footer:
      "Payments are processed securely by Stripe. Cancel anytime from account settings.",
    errorGeneric: "Something went wrong. Please try again.",
    errorNetwork: "Network error. Please check your connection.",
    logout: "Log out",
    banners: {
      none: {
        title: "Activate your practice workspace",
        sub: "Select a plan to unlock your consultant dashboard, client files, and Maple AI tools.",
      },
      trial_expired: {
        title: "Your free trial has ended",
        sub: "Subscribe to keep serving clients on RCICMASTER without interruption.",
      },
      expired: {
        title: "Your subscription has expired",
        sub: "Renew now to restore full access to your consultant dashboard.",
      },
      payment_declined: {
        title: "Payment could not be processed",
        sub: "Update billing by choosing a plan below — your workspace unlocks as soon as payment succeeds.",
      },
      cancelled: {
        title: "Your subscription is inactive",
        sub: "Reactivate a plan to continue managing cases and client communications.",
      },
    },
  },
  fr: {
    badgeActive: "Abonnement requis",
    trustSecure: "Paiement sécurisé",
    trustCancel: "Annulation en tout temps",
    trustSupport: "Soutien au Canada",
    monthly: "Mensuel",
    yearly: "Annuel",
    saveLabel: "Économisez ~20 %",
    perMonth: "/mois",
    perYear: "/an",
    trialAvailable: (days: number) => `Essai gratuit de ${days} jours`,
    trialUsed: "Essai déjà utilisé",
    trialBtn: (days: number) => `Commencer l'essai de ${days} jours`,
    subscribeMonthly: "Continuer au mensuel",
    subscribeYearly: "Continuer à l'annuel",
    mostPopular: "Recommandé",
    choosePlan: "Choisir un forfait",
    footer:
      "Les paiements sont traités de façon sécurisée par Stripe. Annulez en tout temps dans les paramètres du compte.",
    errorGeneric: "Une erreur est survenue. Veuillez réessayer.",
    errorNetwork: "Erreur réseau. Veuillez vérifier votre connexion.",
    logout: "Déconnexion",
    banners: {
      none: {
        title: "Activez votre espace de pratique",
        sub: "Choisissez un forfait pour déverrouiller le tableau de bord, les dossiers clients et Maple AI.",
      },
      trial_expired: {
        title: "Votre essai gratuit est terminé",
        sub: "Abonnez-vous pour continuer à servir vos clients sur RCICMASTER.",
      },
      expired: {
        title: "Votre abonnement a expiré",
        sub: "Renouvelez pour rétablir l'accès complet à votre tableau de bord.",
      },
      payment_declined: {
        title: "Le paiement n'a pas pu être traité",
        sub: "Choisissez un forfait ci-dessous — l'accès se rétablit dès que le paiement réussit.",
      },
      cancelled: {
        title: "Votre abonnement est inactif",
        sub: "Réactivez un forfait pour continuer la gestion des dossiers et des communications.",
      },
    },
  },
} as const;

type Lang = "en" | "fr";
type LocaleStrings = (typeof strings)[Lang];

type SubscriptionPackage = {
  id: number;
  name: string;
  name_fr: string | null;
  description: string | null;
  description_fr: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  free_trial_days: number | null;
  features: string[] | null;
  features_fr: string[] | null;
  sort_order: number;
};

type SubscriptionRecord = {
  id: number;
  status: "trial" | "active" | "expired" | "payment_declined" | "cancelled";
  is_trial: boolean;
  trial_ends_at: string | null;
  ends_at: string | null;
  billing_cycle: "monthly" | "yearly" | null;
  package?: SubscriptionPackage;
};

type StatusResponse = {
  is_active: boolean;
  trial_used: boolean;
  subscription: SubscriptionRecord | null;
};

type GuardStatus =
  | "loading"
  | "active"
  | "none"
  | "trial_expired"
  | "expired"
  | "payment_declined"
  | "cancelled";

function fmtPrice(n: number | null, lang: Lang) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
  }).format(n);
}

function pkgName(pkg: SubscriptionPackage, lang: Lang) {
  return lang === "fr" && pkg.name_fr ? pkg.name_fr : pkg.name;
}
function pkgDesc(pkg: SubscriptionPackage, lang: Lang) {
  return lang === "fr" && pkg.description_fr ? pkg.description_fr : pkg.description;
}
function pkgFeatures(pkg: SubscriptionPackage, lang: Lang): string[] {
  if (lang === "fr" && pkg.features_fr && pkg.features_fr.length > 0) return pkg.features_fr;
  return pkg.features ?? [];
}

function PlanCard({
  pkg,
  billing,
  trialUsed,
  lang,
  t,
  isPopular,
  index,
  onStartTrial,
  onSubscribe,
  loading,
}: {
  pkg: SubscriptionPackage;
  billing: "monthly" | "yearly";
  trialUsed: boolean;
  lang: Lang;
  t: LocaleStrings;
  isPopular: boolean;
  index: number;
  onStartTrial: (id: number) => void;
  onSubscribe: (id: number, cycle: "monthly" | "yearly") => void;
  loading: boolean;
}) {
  const price = billing === "yearly" ? pkg.yearly_price : pkg.monthly_price;
  const showTrial = !trialUsed && !!pkg.free_trial_days && pkg.free_trial_days > 0;
  const features = pkgFeatures(pkg, lang);

  return (
    <article
      className={`sg-plan relative flex flex-col ${isPopular ? "sg-plan--popular" : ""}`}
      style={{ animationDelay: `${180 + index * 90}ms` }}
    >
      {isPopular && <span className="sg-plan__badge">{t.mostPopular}</span>}

      <header className="sg-plan__head">
        <h3>{pkgName(pkg, lang)}</h3>
        {pkgDesc(pkg, lang) ? <p>{pkgDesc(pkg, lang)}</p> : null}
      </header>

      <div className="sg-plan__price">
        <strong>{fmtPrice(price, lang)}</strong>
        <span>{billing === "yearly" ? t.perYear : t.perMonth}</span>
      </div>

      {pkg.free_trial_days && pkg.free_trial_days > 0 ? (
        <p className={`sg-plan__trial ${trialUsed ? "is-used" : ""}`}>
          {trialUsed ? t.trialUsed : t.trialAvailable(pkg.free_trial_days)}
        </p>
      ) : null}

      {features.length > 0 ? (
        <ul className="sg-plan__features">
          {features.map((f, i) => (
            <li key={i}>
              <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="sg-plan__features-spacer" />
      )}

      <div className="sg-plan__actions">
        {showTrial ? (
          <button
            type="button"
            className="sg-btn sg-btn--ghost"
            onClick={() => onStartTrial(pkg.id)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.trialBtn(pkg.free_trial_days!)}
          </button>
        ) : null}
        <button
          type="button"
          className={`sg-btn ${isPopular ? "sg-btn--primary" : "sg-btn--dark"}`}
          onClick={() => onSubscribe(pkg.id, billing)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : billing === "yearly" ? (
            t.subscribeYearly
          ) : (
            t.subscribeMonthly
          )}
        </button>
      </div>
    </article>
  );
}

export function SubscriptionGuard() {
  const router = useRouter();

  const [guardStatus, setGuardStatus] = useState<GuardStatus>("loading");
  const [trialUsed, setTrialUsed] = useState(false);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [lang, setLang] = useState<Lang>("en");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState("");

  const t = strings[lang];

  function detectLanguage(): Lang {
    try {
      const raw = localStorage.getItem("wtc_consultant_user");
      if (raw) {
        const user = JSON.parse(raw);
        if (user.locale === "fr") return "fr";
      }
    } catch {
      /* ignore */
    }
    return "en";
  }

  function applyStatus(data: StatusResponse) {
    setTrialUsed(data.trial_used);
    if (data.is_active) {
      setGuardStatus("active");
      return;
    }
    const sub = data.subscription;
    if (!sub) {
      setGuardStatus("none");
      return;
    }
    if (sub.status === "payment_declined") setGuardStatus("payment_declined");
    else if (sub.is_trial && (sub.status === "expired" || sub.status === "trial"))
      setGuardStatus("trial_expired");
    else if (sub.status === "expired") setGuardStatus("expired");
    else setGuardStatus("cancelled");
  }

  async function loadStatus() {
    const token = localStorage.getItem("wtc_consultant_token");
    if (!token) return;

    setLang(detectLanguage());

    try {
      const raw = localStorage.getItem("wtc_consultant_user");
      if (raw) {
        const user = JSON.parse(raw);
        if (!user.is_license_verified) {
          setGuardStatus("active");
          return;
        }
      }
    } catch {
      /* ignore */
    }

    try {
      const res = await fetch(`${API}/consultant/subscription`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) return;
      applyStatus(await res.json());
    } catch {
      /* ignore */
    }
  }

  async function loadPackages() {
    try {
      const res = await fetch(`${API}/subscription-packages`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      setPackages(data.data ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (guardStatus !== "loading" && guardStatus !== "active") loadPackages();
  }, [guardStatus]);

  async function handleStartTrial(packageId: number) {
    setError("");
    setActionLoading(packageId);
    const token = localStorage.getItem("wtc_consultant_token");
    try {
      const res = await fetch(`${API}/consultant/subscription/start-trial`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ subscription_package_id: packageId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? t.errorGeneric);
        return;
      }
      setGuardStatus("active");
    } catch {
      setError(t.errorNetwork);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSubscribe(packageId: number, cycle: "monthly" | "yearly") {
    setError("");
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;
    const price = cycle === "yearly" ? pkg.yearly_price : pkg.monthly_price;
    if (!price || price <= 0) {
      setError(t.errorGeneric);
      return;
    }
    const params = new URLSearchParams({
      packageId: String(packageId),
      packageName: pkgName(pkg, lang),
      price: String(price),
      billingCycle: cycle,
      lang,
    });
    router.push(`/dashboard/subscribe?${params.toString()}`);
  }

  function handleLogout() {
    localStorage.removeItem("wtc_consultant_token");
    localStorage.removeItem("wtc_consultant_user");
    document.cookie = "wtc_consultant_token=; path=/; max-age=0; SameSite=Lax";
    window.location.replace(CONSULTANT_LOGIN_URL);
  }

  if (guardStatus === "loading" || guardStatus === "active") return null;

  const banner = t.banners[guardStatus];
  const popularIdx = packages.length > 1 ? Math.floor((packages.length - 1) / 2) : 0;

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap"
      />
      <style>{`
        .sg-root {
          --sg-red: #d01d20;
          --sg-red-deep: #9e1417;
          --sg-ink: #0a0b0d;
          --sg-paper: #f3f5f8;
          --sg-line: rgba(10, 11, 13, 0.08);
          --sg-muted: #5c616b;
          font-family: "Outfit", sans-serif;
          color: var(--sg-ink);
        }

        .sg-root * {
          box-sizing: border-box;
        }

        @keyframes sg-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes sg-rise {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes sg-logo {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .sg-backdrop {
          position: fixed;
          inset: 0;
          z-index: 60;
          overflow-y: auto;
          background:
            radial-gradient(ellipse 90% 60% at 50% -10%, rgba(208, 29, 32, 0.28), transparent 55%),
            radial-gradient(circle at 85% 90%, rgba(208, 29, 32, 0.12), transparent 40%),
            linear-gradient(165deg, #16171b 0%, #0a0b0d 48%, #111214 100%);
          animation: sg-fade 0.45s ease both;
        }

        .sg-backdrop::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.35;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
          mix-blend-mode: soft-light;
        }

        .sg-shell {
          position: relative;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1.25rem 1rem 2.5rem;
          gap: 1.25rem;
        }

        @media (min-width: 768px) {
          .sg-shell {
            padding: 2rem 1.5rem 3rem;
            gap: 1.75rem;
          }
        }

        .sg-topbar {
          width: 100%;
          max-width: 68rem;
          display: flex;
          justify-content: flex-end;
          animation: sg-fade 0.5s ease 0.1s both;
        }

        .sg-topbar__actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .sg-lang {
          display: inline-flex;
          padding: 0.2rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .sg-lang button {
          border: 0;
          background: transparent;
          color: rgba(255, 255, 255, 0.55);
          font: 600 0.7rem/1 Outfit, sans-serif;
          letter-spacing: 0.04em;
          padding: 0.45rem 0.85rem;
          border-radius: 999px;
          cursor: pointer;
          transition: color 0.2s, background 0.2s;
        }

        .sg-lang button.is-on {
          background: var(--sg-red);
          color: #fff;
        }

        .sg-lang button:not(.is-on):hover {
          color: #fff;
        }

        .sg-logout {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.72);
          font: 500 0.72rem/1 Outfit, sans-serif;
          padding: 0.55rem 0.95rem;
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }

        .sg-logout:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }

        .sg-panel {
          width: 100%;
          max-width: 68rem;
          border-radius: 1.5rem;
          overflow: hidden;
          background: var(--sg-paper);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.08),
            0 28px 80px rgba(0, 0, 0, 0.45);
          animation: sg-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
        }

        .sg-hero {
          position: relative;
          padding: 2.25rem 1.5rem 1.75rem;
          text-align: center;
          background:
            linear-gradient(180deg, #ffffff 0%, var(--sg-paper) 100%);
          border-bottom: 1px solid var(--sg-line);
        }

        @media (min-width: 768px) {
          .sg-hero {
            padding: 2.75rem 3rem 2rem;
          }
        }

        .sg-hero::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--sg-red-deep), var(--sg-red), #e85a5c);
        }

        .sg-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.35rem;
          padding: 0.85rem 1.15rem;
          border-radius: 1rem;
          background: #fff;
          box-shadow:
            0 1px 0 rgba(10, 11, 13, 0.04),
            0 12px 32px rgba(208, 29, 32, 0.1);
          animation: sg-logo 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both;
        }

        .sg-logo img {
          height: 2.75rem;
          width: auto;
          display: block;
          object-fit: contain;
        }

        .sg-kicker {
          display: inline-block;
          margin-bottom: 0.75rem;
          font: 600 0.68rem/1 Outfit, sans-serif;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--sg-red);
        }

        .sg-hero h1 {
          margin: 0 auto;
          max-width: 30rem;
          font: 700 clamp(1.5rem, 2.5vw, 2rem)/1.2 Outfit, sans-serif;
          letter-spacing: -0.03em;
          color: var(--sg-ink);
        }

        .sg-hero p {
          margin: 0.75rem auto 0;
          max-width: 32rem;
          font: 400 0.95rem/1.55 Outfit, sans-serif;
          color: var(--sg-muted);
        }

        .sg-body {
          padding: 1.5rem 1.25rem 1.75rem;
        }

        @media (min-width: 768px) {
          .sg-body {
            padding: 1.75rem 2.5rem 2.25rem;
          }
        }

        .sg-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .sg-controls__label {
          font: 600 0.72rem/1 Outfit, sans-serif;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--sg-muted);
        }

        .sg-billing {
          display: inline-grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.25rem;
          padding: 0.25rem;
          border-radius: 999px;
          background: rgba(10, 11, 13, 0.05);
          border: 1px solid var(--sg-line);
        }

        .sg-billing button {
          position: relative;
          border: 0;
          background: transparent;
          cursor: pointer;
          font: 600 0.85rem/1 Outfit, sans-serif;
          color: var(--sg-muted);
          padding: 0.65rem 1.35rem;
          border-radius: 999px;
          transition: color 0.2s, background 0.2s, box-shadow 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          white-space: nowrap;
        }

        .sg-billing button.is-on {
          background: #fff;
          color: var(--sg-ink);
          box-shadow: 0 1px 3px rgba(10, 11, 13, 0.08);
        }

        .sg-save {
          font: 700 0.62rem/1 Outfit, sans-serif;
          letter-spacing: 0.02em;
          color: var(--sg-red);
          background: rgba(208, 29, 32, 0.08);
          padding: 0.28rem 0.45rem;
          border-radius: 999px;
        }

        .sg-error {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
          margin: 0 auto 1.25rem;
          max-width: 36rem;
          padding: 0.85rem 1rem;
          border-radius: 0.85rem;
          border: 1px solid rgba(208, 29, 32, 0.25);
          background: rgba(208, 29, 32, 0.06);
          color: var(--sg-red-deep);
          font: 500 0.85rem/1.4 Outfit, sans-serif;
        }

        .sg-plans {
          display: grid;
          gap: 1rem;
          grid-template-columns: 1fr;
        }

        @media (min-width: 720px) {
          .sg-plans {
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.15rem;
            align-items: stretch;
          }
        }

        .sg-plan {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
          padding: 1.5rem 1.35rem 1.35rem;
          border-radius: 1.15rem;
          background: #fff;
          border: 1px solid var(--sg-line);
          transition:
            transform 0.25s ease,
            border-color 0.25s ease,
            box-shadow 0.25s ease;
          animation: sg-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .sg-plan:hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 40px rgba(10, 11, 13, 0.08);
        }

        .sg-plan--popular {
          border-color: rgba(208, 29, 32, 0.45);
          box-shadow:
            0 0 0 1px rgba(208, 29, 32, 0.12),
            0 18px 44px rgba(208, 29, 32, 0.1);
        }

        .sg-plan__badge {
          position: absolute;
          top: -0.7rem;
          left: 50%;
          transform: translateX(-50%);
          background: var(--sg-red);
          color: #fff;
          font: 700 0.65rem/1 Outfit, sans-serif;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 0.4rem 0.75rem;
          border-radius: 999px;
          white-space: nowrap;
        }

        .sg-plan__head h3 {
          margin: 0;
          font: 700 1.05rem/1.25 Outfit, sans-serif;
          letter-spacing: -0.02em;
          color: var(--sg-ink);
        }

        .sg-plan__head p {
          margin: 0.4rem 0 0;
          font: 400 0.82rem/1.45 Outfit, sans-serif;
          color: var(--sg-muted);
        }

        .sg-plan__price {
          display: flex;
          align-items: baseline;
          gap: 0.35rem;
        }

        .sg-plan__price strong {
          font: 800 2.15rem/1 Outfit, sans-serif;
          letter-spacing: -0.04em;
          color: var(--sg-ink);
        }

        .sg-plan__price span {
          font: 500 0.85rem/1 Outfit, sans-serif;
          color: var(--sg-muted);
        }

        .sg-plan__trial {
          margin: 0;
          align-self: flex-start;
          font: 600 0.72rem/1 Outfit, sans-serif;
          color: #1f6b45;
          background: rgba(31, 107, 69, 0.08);
          border: 1px solid rgba(31, 107, 69, 0.18);
          padding: 0.4rem 0.65rem;
          border-radius: 999px;
        }

        .sg-plan__trial.is-used {
          color: var(--sg-muted);
          background: rgba(10, 11, 13, 0.04);
          border-color: var(--sg-line);
        }

        .sg-plan__features {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
          flex: 1;
        }

        .sg-plan__features-spacer {
          flex: 1;
        }

        .sg-plan__features li {
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          font: 500 0.86rem/1.4 Outfit, sans-serif;
          color: #2a2e36;
        }

        .sg-plan__features svg {
          margin-top: 0.15rem;
          flex-shrink: 0;
          color: var(--sg-red);
        }

        .sg-plan__actions {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          margin-top: auto;
          padding-top: 0.35rem;
        }

        .sg-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          width: 100%;
          min-height: 2.75rem;
          border-radius: 0.75rem;
          border: 0;
          cursor: pointer;
          font: 600 0.88rem/1 Outfit, sans-serif;
          letter-spacing: -0.01em;
          transition:
            background 0.2s,
            transform 0.15s,
            opacity 0.2s;
        }

        .sg-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .sg-btn:not(:disabled):active {
          transform: scale(0.985);
        }

        .sg-btn--primary {
          background: var(--sg-red);
          color: #fff;
          box-shadow: 0 10px 24px rgba(208, 29, 32, 0.28);
        }

        .sg-btn--primary:hover:not(:disabled) {
          background: var(--sg-red-deep);
        }

        .sg-btn--dark {
          background: var(--sg-ink);
          color: #fff;
        }

        .sg-btn--dark:hover:not(:disabled) {
          background: #1c1f26;
        }

        .sg-btn--ghost {
          background: transparent;
          color: var(--sg-red);
          border: 1px solid rgba(208, 29, 32, 0.28);
        }

        .sg-btn--ghost:hover:not(:disabled) {
          background: rgba(208, 29, 32, 0.05);
        }

        .sg-loading {
          display: flex;
          justify-content: center;
          padding: 3.5rem 0;
          color: var(--sg-red);
        }

        .sg-trust {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 1rem 1.75rem;
          margin-top: 1.75rem;
          padding-top: 1.35rem;
          border-top: 1px solid var(--sg-line);
        }

        .sg-trust span {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font: 500 0.78rem/1 Outfit, sans-serif;
          color: var(--sg-muted);
        }

        .sg-trust svg {
          color: var(--sg-red);
        }

        .sg-foot {
          margin-top: 1.15rem;
          text-align: center;
          font: 400 0.75rem/1.5 Outfit, sans-serif;
          color: var(--sg-muted);
          max-width: 34rem;
          margin-left: auto;
          margin-right: auto;
        }

        .sg-copy {
          font: 400 0.7rem/1 Outfit, sans-serif;
          letter-spacing: 0.04em;
          color: rgba(255, 255, 255, 0.32);
          animation: sg-fade 0.6s ease 0.35s both;
        }
      `}</style>

      <div className="sg-root sg-backdrop" role="dialog" aria-modal="true" aria-labelledby="sg-title">
        <div className="sg-shell">
          <div className="sg-topbar">
            <div className="sg-topbar__actions">
              <div className="sg-lang" role="group" aria-label="Language">
                {(["en", "fr"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={lang === l ? "is-on" : ""}
                    onClick={() => setLang(l)}
                  >
                    {l === "en" ? "EN" : "FR"}
                  </button>
                ))}
              </div>
              <button type="button" className="sg-logout" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5" />
                {t.logout}
              </button>
            </div>
          </div>

          <div className="sg-panel">
            <header className="sg-hero">
              <div className="sg-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/rcicmaster-logo.png" alt="RCICMASTER" />
              </div>
              <span className="sg-kicker">{t.badgeActive}</span>
              <h1 id="sg-title">{banner.title}</h1>
              <p>{banner.sub}</p>
            </header>

            <div className="sg-body">
              <div className="sg-controls">
                <span className="sg-controls__label">{t.choosePlan}</span>
                <div className="sg-billing" role="group" aria-label="Billing cycle">
                  <button
                    type="button"
                    className={billing === "monthly" ? "is-on" : ""}
                    onClick={() => setBilling("monthly")}
                  >
                    {t.monthly}
                  </button>
                  <button
                    type="button"
                    className={billing === "yearly" ? "is-on" : ""}
                    onClick={() => setBilling("yearly")}
                  >
                    {t.yearly}
                    <span className="sg-save">{t.saveLabel}</span>
                  </button>
                </div>
              </div>

              {error ? (
                <div className="sg-error" role="alert">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              ) : null}

              {packages.length === 0 ? (
                <div className="sg-loading">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="sg-plans">
                  {packages.map((pkg, idx) => (
                    <PlanCard
                      key={pkg.id}
                      pkg={pkg}
                      billing={billing}
                      trialUsed={trialUsed}
                      lang={lang}
                      t={t}
                      isPopular={idx === popularIdx}
                      index={idx}
                      onStartTrial={handleStartTrial}
                      onSubscribe={handleSubscribe}
                      loading={actionLoading === pkg.id}
                    />
                  ))}
                </div>
              )}

              <div className="sg-trust">
                <span>
                  <Lock className="h-3.5 w-3.5" />
                  {t.trustSecure}
                </span>
                <span>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t.trustCancel}
                </span>
                <span>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t.trustSupport}
                </span>
              </div>

              <p className="sg-foot">{t.footer}</p>
            </div>
          </div>

          <p className="sg-copy">© {new Date().getFullYear()} RCICMASTER · rcicmaster.ca</p>
        </div>
      </div>
    </>
  );
}

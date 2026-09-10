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
  X,
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
    perMonth: "/mo",
    perYear: "/yr",
    trialAvailable: (days: number) => `${days}-day free trial`,
    trialUsed: "Trial already used",
    trialBtn: (days: number) => `Start ${days}-day trial`,
    subscribeMonthly: "Continue monthly",
    subscribeYearly: "Continue yearly",
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
        sub: "Choose a plan below — your workspace unlocks as soon as payment succeeds.",
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
    trialAvailable: (days: number) => `Essai de ${days} jours`,
    trialUsed: "Essai déjà utilisé",
    trialBtn: (days: number) => `Commencer l'essai de ${days} jours`,
    subscribeMonthly: "Continuer au mensuel",
    subscribeYearly: "Continuer à l'annuel",
    mostPopular: "Recommandé",
    choosePlan: "Choisir un forfait",
    footer:
      "Les paiements sont traités de façon sécurisée par Stripe. Annulez en tout temps dans les paramètres.",
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
        sub: "Choisissez un forfait — l'accès se rétablit dès que le paiement réussit.",
      },
      cancelled: {
        title: "Votre abonnement est inactif",
        sub: "Réactivez un forfait pour continuer la gestion des dossiers.",
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
  onStartTrial: (id: number) => void;
  onSubscribe: (id: number, cycle: "monthly" | "yearly") => void;
  loading: boolean;
}) {
  const price = billing === "yearly" ? pkg.yearly_price : pkg.monthly_price;
  const showTrial = !trialUsed && !!pkg.free_trial_days && pkg.free_trial_days > 0;
  const features = pkgFeatures(pkg, lang);

  return (
    <article className={`sg-plan ${isPopular ? "sg-plan--popular" : ""}`}>
      {isPopular ? <span className="sg-plan__badge">{t.mostPopular}</span> : null}

      <div className="sg-plan__top">
        <h3>{pkgName(pkg, lang)}</h3>
        {pkgDesc(pkg, lang) ? <p>{pkgDesc(pkg, lang)}</p> : <p className="sg-plan__desc-spacer">&nbsp;</p>}
      </div>

      <div className="sg-plan__price">
        <strong>{fmtPrice(price, lang)}</strong>
        <span>{billing === "yearly" ? t.perYear : t.perMonth}</span>
      </div>

      {pkg.free_trial_days && pkg.free_trial_days > 0 ? (
        <p className={`sg-plan__trial ${trialUsed ? "is-used" : ""}`}>
          {trialUsed ? t.trialUsed : t.trialAvailable(pkg.free_trial_days)}
        </p>
      ) : (
        <p className="sg-plan__trial sg-plan__trial--empty">&nbsp;</p>
      )}

      <ul className="sg-plan__features">
        {features.map((f, i) => (
          <li key={i}>
            <span className="sg-check" aria-hidden>
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

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
          className={`sg-btn ${isPopular ? "sg-btn--primary" : "sg-btn--secondary"}`}
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
  const [dismissed, setDismissed] = useState(false);

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

  if (guardStatus === "loading" || guardStatus === "active" || dismissed) return null;

  const banner = t.banners[guardStatus];
  const popularIdx = packages.length > 1 ? Math.floor((packages.length - 1) / 2) : 0;

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&display=swap"
      />
      <style>{`
        .sg-root {
          --red: #d01d20;
          --red-dark: #b0181b;
          --ink: #111318;
          --muted: #667085;
          --line: #e6e8ee;
          --soft: #f6f7f9;
          --white: #ffffff;
          font-family: "Manrope", "Segoe UI", sans-serif;
          color: var(--ink);
        }
        .sg-root *, .sg-root *::before, .sg-root *::after { box-sizing: border-box; }

        @keyframes sg-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .sg-backdrop {
          position: fixed;
          inset: 0;
          z-index: 60;
          overflow-y: auto;
          background: rgba(15, 17, 21, 0.35);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .sg-shell {
          min-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem 1rem 2rem;
        }

        .sg-panel {
          width: 100%;
          max-width: 1080px;
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(17, 19, 24, 0.08);
          overflow: hidden;
          animation: sg-in 0.4s ease both;
        }

        /* ── Top bar: logo | controls ── */
        .sg-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--line);
          background: var(--white);
        }

        .sg-brand {
          display: flex;
          align-items: center;
          min-width: 0;
        }

        .sg-brand img {
          height: 40px;
          width: auto;
          display: block;
          object-fit: contain;
        }

        .sg-bar__actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .sg-close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--white);
          color: var(--muted);
          cursor: pointer;
        }

        .sg-close:hover {
          color: var(--ink);
          border-color: #d0d5dd;
          background: var(--soft);
        }

        .sg-lang {
          display: inline-flex;
          padding: 3px;
          border-radius: 999px;
          background: var(--soft);
          border: 1px solid var(--line);
        }

        .sg-lang button {
          border: 0;
          background: transparent;
          cursor: pointer;
          font: 700 0.7rem/1 Manrope, sans-serif;
          letter-spacing: 0.04em;
          color: var(--muted);
          padding: 0.4rem 0.7rem;
          border-radius: 999px;
        }

        .sg-lang button.is-on {
          background: var(--white);
          color: var(--ink);
          box-shadow: 0 1px 2px rgba(17, 19, 24, 0.08);
        }

        .sg-logout {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          border: 1px solid var(--line);
          background: var(--white);
          color: var(--muted);
          font: 600 0.75rem/1 Manrope, sans-serif;
          padding: 0.48rem 0.8rem;
          border-radius: 999px;
          cursor: pointer;
        }

        .sg-logout:hover {
          color: var(--ink);
          border-color: #d0d5dd;
        }

        /* ── Intro ── */
        .sg-intro {
          text-align: center;
          padding: 1.75rem 1.5rem 0.25rem;
          max-width: 560px;
          margin: 0 auto;
        }

        .sg-intro h1 {
          margin: 0;
          font-size: clamp(1.35rem, 2.2vw, 1.75rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.25;
          color: var(--ink);
        }

        .sg-intro p {
          margin: 0.55rem 0 0;
          font-size: 0.92rem;
          line-height: 1.55;
          color: var(--muted);
          font-weight: 500;
        }

        /* ── Body ── */
        .sg-body {
          padding: 1.25rem 1.5rem 1.5rem;
        }

        @media (min-width: 900px) {
          .sg-bar, .sg-body { padding-left: 2rem; padding-right: 2rem; }
          .sg-intro { padding-left: 2rem; padding-right: 2rem; }
        }

        .sg-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.65rem;
          margin: 1.25rem 0 1.35rem;
        }

        .sg-controls__label {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .sg-billing {
          display: inline-grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
          padding: 3px;
          border-radius: 999px;
          background: var(--soft);
          border: 1px solid var(--line);
        }

        .sg-billing button {
          border: 0;
          background: transparent;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          white-space: nowrap;
          font: 700 0.84rem/1 Manrope, sans-serif;
          color: var(--muted);
          padding: 0.6rem 1.15rem;
          border-radius: 999px;
        }

        .sg-billing button.is-on {
          background: var(--white);
          color: var(--ink);
          box-shadow: 0 1px 3px rgba(17, 19, 24, 0.08);
        }

        .sg-save {
          font-size: 0.62rem;
          font-weight: 800;
          color: var(--red);
          background: rgba(208, 29, 32, 0.08);
          padding: 0.22rem 0.4rem;
          border-radius: 999px;
        }

        .sg-error {
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          max-width: 520px;
          margin: 0 auto 1rem;
          padding: 0.75rem 0.9rem;
          border-radius: 10px;
          border: 1px solid rgba(208, 29, 32, 0.22);
          background: rgba(208, 29, 32, 0.05);
          color: var(--red-dark);
          font-size: 0.85rem;
          font-weight: 600;
        }

        .sg-loading {
          display: flex;
          justify-content: center;
          padding: 3rem 0;
          color: var(--red);
        }

        /* ── Plans grid — equal columns, equal height ── */
        .sg-plans {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          align-items: stretch;
        }

        @media (min-width: 860px) {
          .sg-plans {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 1rem;
          }
        }

        .sg-plan {
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 100%;
          padding: 1.35rem 1.2rem 1.2rem;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--white);
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .sg-plan:hover {
          border-color: #d0d5dd;
          box-shadow: 0 8px 24px rgba(17, 19, 24, 0.05);
        }

        .sg-plan--popular {
          border-color: rgba(208, 29, 32, 0.45);
          background: linear-gradient(180deg, #fff8f8 0%, #ffffff 40%);
          box-shadow: 0 10px 28px rgba(208, 29, 32, 0.08);
        }

        .sg-plan__badge {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--red);
          color: #fff;
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 0.32rem 0.65rem;
          border-radius: 999px;
          white-space: nowrap;
        }

        .sg-plan__top {
          min-height: 4.4rem;
        }

        .sg-plan__top h3 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .sg-plan__top p {
          margin: 0.35rem 0 0;
          font-size: 0.8rem;
          line-height: 1.4;
          color: var(--muted);
          font-weight: 500;
        }

        .sg-plan__price {
          display: flex;
          align-items: baseline;
          gap: 0.3rem;
          margin-top: 0.85rem;
        }

        .sg-plan__price strong {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .sg-plan__price span {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--muted);
        }

        .sg-plan__trial {
          margin: 0.75rem 0 0;
          align-self: flex-start;
          font-size: 0.7rem;
          font-weight: 700;
          color: #147a45;
          background: rgba(20, 122, 69, 0.08);
          border: 1px solid rgba(20, 122, 69, 0.16);
          padding: 0.32rem 0.55rem;
          border-radius: 999px;
          min-height: 1.55rem;
        }

        .sg-plan__trial.is-used {
          color: var(--muted);
          background: var(--soft);
          border-color: var(--line);
        }

        .sg-plan__trial--empty {
          background: transparent;
          border-color: transparent;
        }

        .sg-plan__features {
          list-style: none;
          margin: 1rem 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          flex: 1;
        }

        .sg-plan__features li {
          display: grid;
          grid-template-columns: 18px 1fr;
          gap: 0.5rem;
          align-items: start;
          font-size: 0.82rem;
          line-height: 1.4;
          font-weight: 500;
          color: #344054;
        }

        .sg-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: rgba(208, 29, 32, 0.08);
          color: var(--red);
          margin-top: 1px;
        }

        .sg-plan__actions {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          margin-top: 1.15rem;
        }

        .sg-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 42px;
          border-radius: 10px;
          border: 0;
          cursor: pointer;
          font: 700 0.84rem/1 Manrope, sans-serif;
          transition: background 0.15s, opacity 0.15s;
        }

        .sg-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .sg-btn--primary {
          background: var(--red);
          color: #fff;
        }
        .sg-btn--primary:hover:not(:disabled) { background: var(--red-dark); }

        .sg-btn--secondary {
          background: var(--ink);
          color: #fff;
        }
        .sg-btn--secondary:hover:not(:disabled) { background: #1d2129; }

        .sg-btn--ghost {
          background: transparent;
          color: var(--red);
          border: 1px solid rgba(208, 29, 32, 0.28);
        }
        .sg-btn--ghost:hover:not(:disabled) {
          background: rgba(208, 29, 32, 0.04);
        }

        /* ── Footer inside panel ── */
        .sg-foot {
          margin-top: 1.5rem;
          padding-top: 1.15rem;
          border-top: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          text-align: center;
        }

        .sg-trust {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.75rem 1.5rem;
        }

        .sg-trust span {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--muted);
        }

        .sg-trust svg { color: var(--red); }

        .sg-foot p {
          margin: 0;
          max-width: 420px;
          font-size: 0.72rem;
          line-height: 1.5;
          color: #98a2b3;
          font-weight: 500;
        }

        @media (max-width: 640px) {
          .sg-bar {
            flex-wrap: wrap;
          }
          .sg-shell { padding: 0.75rem; align-items: flex-start; }
          .sg-panel { border-radius: 14px; }
        }
      `}</style>

      <div className="sg-root sg-backdrop" role="dialog" aria-modal="true" aria-labelledby="sg-title">
        <div className="sg-shell">
          <div className="sg-panel">
            {/* Header: logo + status | language + logout — all inside panel */}
            <div className="sg-bar">
              <div className="sg-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/rcicmaster-logo.png" alt="RCICMASTER" />
              </div>

              <div className="sg-bar__actions">
                <div className="sg-lang" role="group" aria-label="Language">
                  {(["en", "fr"] as Lang[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      className={lang === l ? "is-on" : ""}
                      onClick={() => setLang(l)}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button type="button" className="sg-logout" onClick={handleLogout}>
                  <LogOut className="h-3.5 w-3.5" />
                  {t.logout}
                </button>
                <button
                  type="button"
                  className="sg-close"
                  onClick={() => setDismissed(true)}
                  aria-label={lang === "fr" ? "Fermer" : "Close"}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <header className="sg-intro">
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
                  <Loader2 className="h-7 w-7 animate-spin" />
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
                      onStartTrial={handleStartTrial}
                      onSubscribe={handleSubscribe}
                      loading={actionLoading === pkg.id}
                    />
                  ))}
                </div>
              )}

              <div className="sg-foot">
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
                <p>{t.footer}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

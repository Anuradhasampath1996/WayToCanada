"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Info,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// ─────────────────────────────────────────────────────────────────────────────
// i18n strings
// ─────────────────────────────────────────────────────────────────────────────

const strings = {
  en: {
    badgeActive:      "Subscription Required",
    trustSecure:      "Secure Payment",
    trustCancel:      "Cancel Anytime",
    trustSupport:     "Dedicated Support",
    monthly:          "Monthly",
    yearly:           "Yearly",
    saveLabel:        "Save up to 20%",
    perMonth:         "/mo",
    perYear:          "/yr",
    trialAvailable:   (days: number) => `${days}-day free trial included`,
    trialUsed:        "Free trial already used",
    trialBtn:         (days: number) => `Start ${days}-Day Free Trial`,
    subscribeMonthly: "Subscribe Monthly",
    subscribeYearly:  "Subscribe Yearly",
    mostPopular:      "Most Popular",
    footer:           "Payments are processed securely. You can cancel your subscription at any time from your account settings.",
    errorGeneric:     "Something went wrong. Please try again.",
    errorNetwork:     "Network error. Please check your connection.",
    banners: {
      none:             { title: "Unlock Your Dashboard",                  sub: "Choose the plan that fits your practice and get started today." },
      trial_expired:    { title: "Your Free Trial Has Ended",              sub: "Thank you for trying Way To Canada. Subscribe now to keep your dashboard running." },
      expired:          { title: "Your Subscription Has Expired",          sub: "Renew your plan to restore full access to your consultant dashboard." },
      payment_declined: { title: "Payment Could Not Be Processed",         sub: "We weren't able to charge your payment method. Please select a plan and update your billing details." },
      cancelled:        { title: "Your Subscription Is Inactive",          sub: "Select a plan below to reactivate your account and continue serving your clients." },
    },
  },
  fr: {
    badgeActive:      "Abonnement requis",
    trustSecure:      "Paiement sécurisé",
    trustCancel:      "Annulation à tout moment",
    trustSupport:     "Assistance dédiée",
    monthly:          "Mensuel",
    yearly:           "Annuel",
    saveLabel:        "Économisez jusqu'à 20 %",
    perMonth:         "/mois",
    perYear:          "/an",
    trialAvailable:   (days: number) => `Essai gratuit de ${days} jours inclus`,
    trialUsed:        "Essai gratuit déjà utilisé",
    trialBtn:         (days: number) => `Commencer l'essai gratuit de ${days} jours`,
    subscribeMonthly: "S'abonner mensuellement",
    subscribeYearly:  "S'abonner annuellement",
    mostPopular:      "Le plus populaire",
    footer:           "Les paiements sont traités de manière sécurisée. Vous pouvez annuler votre abonnement à tout moment depuis les paramètres de votre compte.",
    errorGeneric:     "Une erreur est survenue. Veuillez réessayer.",
    errorNetwork:     "Erreur réseau. Veuillez vérifier votre connexion.",
    banners: {
      none:             { title: "Activez votre tableau de bord",          sub: "Choisissez le forfait adapté à votre pratique et commencez dès aujourd'hui." },
      trial_expired:    { title: "Votre essai gratuit est terminé",        sub: "Merci d'avoir essayé Way To Canada. Abonnez-vous maintenant pour continuer." },
      expired:          { title: "Votre abonnement a expiré",              sub: "Renouvelez votre forfait pour rétablir l'accès complet à votre tableau de bord." },
      payment_declined: { title: "Le paiement n'a pas pu être traité",     sub: "Nous n'avons pas pu débiter votre moyen de paiement. Veuillez sélectionner un forfait et mettre à jour vos informations de facturation." },
      cancelled:        { title: "Votre abonnement est inactif",           sub: "Sélectionnez un forfait ci-dessous pour réactiver votre compte." },
    },
  },
} as const;

type Lang = "en" | "fr";
type LocaleStrings = (typeof strings)[Lang];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtPrice(n: number | null, lang: Lang) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
  }).format(n);
}

function pkgName(pkg: SubscriptionPackage, lang: Lang) {
  return (lang === "fr" && pkg.name_fr) ? pkg.name_fr : pkg.name;
}
function pkgDesc(pkg: SubscriptionPackage, lang: Lang) {
  return (lang === "fr" && pkg.description_fr) ? pkg.description_fr : pkg.description;
}
function pkgFeatures(pkg: SubscriptionPackage, lang: Lang): string[] {
  if (lang === "fr" && pkg.features_fr && pkg.features_fr.length > 0) return pkg.features_fr;
  return pkg.features ?? [];
}

// Banner icon + colour mapping
const bannerMeta: Record<
  Exclude<GuardStatus, "loading" | "active">,
  { Icon: React.ElementType; iconClass: string; ringClass: string }
> = {
  none:             { Icon: Sparkles,      iconClass: "text-blue-600",  ringClass: "ring-blue-100 bg-blue-50"   },
  trial_expired:    { Icon: AlertTriangle, iconClass: "text-amber-500", ringClass: "ring-amber-100 bg-amber-50" },
  expired:          { Icon: RefreshCw,     iconClass: "text-amber-500", ringClass: "ring-amber-100 bg-amber-50" },
  payment_declined: { Icon: CreditCard,    iconClass: "text-red-500",   ringClass: "ring-red-100 bg-red-50"     },
  cancelled:        { Icon: Info,          iconClass: "text-slate-500", ringClass: "ring-slate-100 bg-slate-50" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Trust bar
// ─────────────────────────────────────────────────────────────────────────────

function TrustBar({ t }: { t: LocaleStrings }) {
  return (
    <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
      <span className="flex items-center gap-1.5">
        <Lock className="h-4 w-4 text-slate-400" />{t.trustSecure}
      </span>
      <span className="flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4 text-slate-400" />{t.trustCancel}
      </span>
      <span className="flex items-center gap-1.5">
        <Zap className="h-4 w-4 text-slate-400" />{t.trustSupport}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan card
// ─────────────────────────────────────────────────────────────────────────────

function PlanCard({
  pkg, billing, trialUsed, lang, t, isPopular, onStartTrial, onSubscribe, loading,
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
  const price     = billing === "yearly" ? pkg.yearly_price : pkg.monthly_price;
  const showTrial = !trialUsed && !!pkg.free_trial_days && pkg.free_trial_days > 0;
  const features  = pkgFeatures(pkg, lang);

  return (
    <div className={`relative flex flex-col rounded-2xl border bg-white shadow-md transition-shadow hover:shadow-lg w-full max-w-[300px]
      ${isPopular ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200"}`}>

      {isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
            {t.mostPopular}
          </span>
        </div>
      )}

      <div className="p-7 flex flex-col gap-5 flex-1">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">{pkgName(pkg, lang)}</h3>
          {pkgDesc(pkg, lang) && (
            <p className="text-sm text-slate-500 leading-relaxed">{pkgDesc(pkg, lang)}</p>
          )}
        </div>

        <div className="flex items-end gap-1.5">
          <span className="text-4xl font-extrabold text-slate-900 tracking-tight">{fmtPrice(price, lang)}</span>
          <span className="text-sm text-slate-400 mb-1.5 font-medium">
            {billing === "yearly" ? t.perYear : t.perMonth}
          </span>
        </div>

        {pkg.free_trial_days && pkg.free_trial_days > 0 && (
          <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full self-start border
            ${trialUsed ? "text-slate-400 border-slate-200 bg-slate-50" : "text-emerald-700 border-emerald-200 bg-emerald-50"}`}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {trialUsed ? t.trialUsed : t.trialAvailable(pkg.free_trial_days)}
          </div>
        )}

        <Separator />

        {features.length > 0 && (
          <ul className="space-y-3 flex-1">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50">
                  <Check className="h-3.5 w-3.5 text-blue-600 stroke-[2.5]" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2.5 mt-auto pt-1">
          {showTrial && (
            <Button
              variant="outline"
              className="w-full h-10 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 font-semibold"
              onClick={() => onStartTrial(pkg.id)}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.trialBtn(pkg.free_trial_days!)}
            </Button>
          )}
          <Button
            className={`w-full h-11 font-semibold text-sm ${isPopular ? "bg-blue-600 hover:bg-blue-700 shadow" : ""}`}
            onClick={() => onSubscribe(pkg.id, billing)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : billing === "yearly" ? t.subscribeYearly : t.subscribeMonthly}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main guard
// ─────────────────────────────────────────────────────────────────────────────

export function SubscriptionGuard() {
  const router = useRouter();

  const [guardStatus,   setGuardStatus]   = useState<GuardStatus>("loading");
  const [trialUsed,     setTrialUsed]     = useState(false);
  const [packages,      setPackages]      = useState<SubscriptionPackage[]>([]);
  const [billing,       setBilling]       = useState<"monthly" | "yearly">("monthly");
  const [lang,          setLang]          = useState<Lang>("en");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error,         setError]         = useState("");

  const t = strings[lang];

  // ── Read language preference from localStorage (set in Step 4 onboarding) ─
  function detectLanguage(): Lang {
    try {
      const raw = localStorage.getItem("wtc_consultant_user");
      if (raw) {
        const user = JSON.parse(raw);
        if (user.locale === "fr") return "fr";
      }
    } catch {}
    return "en";
  }

  // ── Derive guard state ────────────────────────────────────────────────────
  function applyStatus(data: StatusResponse) {
    setTrialUsed(data.trial_used);
    if (data.is_active) { setGuardStatus("active"); return; }
    const sub = data.subscription;
    if (!sub) { setGuardStatus("none"); return; }
    if (sub.status === "payment_declined")                           setGuardStatus("payment_declined");
    else if (sub.is_trial && (sub.status === "expired" || sub.status === "trial")) setGuardStatus("trial_expired");
    else if (sub.status === "expired")                               setGuardStatus("expired");
    else                                                             setGuardStatus("cancelled");
  }

  // ── Fetch subscription status ─────────────────────────────────────────────
  async function loadStatus() {
    const token = localStorage.getItem("wtc_consultant_token");
    if (!token) return;

    setLang(detectLanguage());

    // Don't show this guard while RCIC onboarding is still pending
    try {
      const raw = localStorage.getItem("wtc_consultant_user");
      if (raw) {
        const user = JSON.parse(raw);
        if (!user.is_license_verified) { setGuardStatus("active"); return; }
      }
    } catch {}

    try {
      const res = await fetch(`${API}/consultant/subscription`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) return;
      applyStatus(await res.json());
    } catch {}
  }

  // ── Fetch packages ────────────────────────────────────────────────────────
  async function loadPackages() {
    try {
      const res = await fetch(`${API}/subscription-packages`, { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const data = await res.json();
      setPackages(data.data ?? []);
    } catch {}
  }

  useEffect(() => { loadStatus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (guardStatus !== "loading" && guardStatus !== "active") loadPackages();
  }, [guardStatus]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleStartTrial(packageId: number) {
    setError(""); setActionLoading(packageId);
    const token = localStorage.getItem("wtc_consultant_token");
    try {
      const res = await fetch(`${API}/consultant/subscription/start-trial`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ subscription_package_id: packageId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.message ?? t.errorGeneric); return; }
      setGuardStatus("active");
    } catch { setError(t.errorNetwork); }
    finally { setActionLoading(null); }
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
      packageId:   String(packageId),
      packageName: pkgName(pkg, lang),
      price:       String(price),
      billingCycle: cycle,
      lang,
    });
    router.push(`/dashboard/subscribe?${params.toString()}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (guardStatus === "loading" || guardStatus === "active") return null;

  const meta      = bannerMeta[guardStatus];
  const banner    = t.banners[guardStatus];
  const BannerIcon = meta.Icon;
  const popularIdx = packages.length > 1 ? Math.floor((packages.length - 1) / 2) : 0;

  return (
    <>
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 backdrop-blur-md">
      <div className="min-h-full flex flex-col items-center px-4 py-12 gap-10">

        {/* ── Header bar ── */}
        <div className="w-full max-w-5xl flex items-center justify-between">
          <span className="text-2xl font-black tracking-tight text-white">
            Way<span className="text-blue-400">To</span>Canada
          </span>

          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <div className="flex items-center gap-1 bg-white/10 rounded-full p-1 border border-white/20">
              {(["en", "fr"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    lang === l ? "bg-white text-slate-900 shadow" : "text-white/70 hover:text-white"
                  }`}
                >
                  {l === "en" ? "🇨🇦 EN" : "🇫🇷 FR"}
                </button>
              ))}
            </div>

            {/* Logout */}
            <button
              onClick={() => {
                localStorage.removeItem("wtc_consultant_token");
                localStorage.removeItem("wtc_consultant_user");
                document.cookie = "wtc_consultant_token=; path=/; max-age=0; SameSite=Lax";
                window.location.replace("http://localhost:3002/login");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-white/80 bg-white/10 border border-white/20 hover:bg-white/20 hover:text-white transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              {lang === "fr" ? "Déconnexion" : "Log out"}
            </button>
          </div>
        </div>

        {/* ── Main card ── */}
        <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Status banner */}
          <div className="flex flex-col items-center text-center gap-4 px-8 pt-10 pb-8 border-b border-slate-100">
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ring-8 ${meta.ringClass}`}>
              <BannerIcon className={`h-7 w-7 ${meta.iconClass}`} />
            </div>
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                {t.badgeActive}
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{banner.title}</h1>
              <p className="text-slate-500 max-w-lg text-sm leading-relaxed">{banner.sub}</p>
            </div>
            <div className="pt-2"><TrustBar t={t} /></div>
          </div>

          {/* Billing toggle */}
          <div className="flex justify-center pt-8 pb-2 px-8">
            <div className="inline-flex items-center bg-slate-100 rounded-full p-1 gap-0.5">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                  billing === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.monthly}
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                  billing === "yearly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.yearly}
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                  {t.saveLabel}
                </span>
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-8 mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Plan cards */}
          <div className="px-8 pt-8 pb-10">
            {packages.length === 0 ? (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-6">
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
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/60 px-8 py-5 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-400 leading-relaxed">{t.footer}</p>
          </div>
        </div>

      </div>
    </div>

    </>
  );
}

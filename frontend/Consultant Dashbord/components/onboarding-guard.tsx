"use client";

import { useEffect, useState } from "react";
import { Globe, Loader2, RefreshCw, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type Status = "loading" | "none" | "onboarding" | "pending";

export function OnboardingGuard() {
  const [status,     setStatus]     = useState<Status>("loading");
  const [step,       setStep]       = useState<1 | 2>(1);
  const [language,   setLanguage]   = useState<"en" | "fr">("en");
  const [rcicNumber, setRcicNumber] = useState("");
  const [error,      setError]      = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch fresh user data from backend ──────────────────────────────────
  const loadUser = (forceRefresh = false) => {
    const token = localStorage.getItem("wtc_consultant_token");
    if (!token) {
      window.location.replace("http://localhost:3001/login");
      return;
    }

    function applyUser(user: { is_license_verified?: boolean; rcic_number?: string | null }) {
      if (user.is_license_verified) setStatus("none");
      else if (user.rcic_number)    setStatus("pending");
      else                          setStatus("onboarding");
    }

    // Fast path: apply cached user immediately (skip when force-refreshing)
    const cachedRaw = localStorage.getItem("wtc_consultant_user");
    if (!forceRefresh && cachedRaw) {
      try { applyUser(JSON.parse(cachedRaw)); } catch {}
    }

    // Fetch live data from backend
    fetch(`${API}/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
      .then((res) => {
        if (!res.ok) {
          // Token invalid/expired and no cache → redirect to login
          if (!cachedRaw) window.location.replace("http://localhost:3001/login");
          return;
        }
        return res.json();
      })
      .then((user) => {
        if (!user) return;
        localStorage.setItem("wtc_consultant_user", JSON.stringify(user));
        applyUser(user);
      })
      .catch(() => {
        // Network error — use cached state if available, otherwise show onboarding
        if (!cachedRaw) setStatus("onboarding");
      })
      .finally(() => {
        if (forceRefresh) setRefreshing(false);
      });
  };

  useEffect(() => {
    // Read license_verified param without useSearchParams to avoid Suspense issues
    const params   = new URLSearchParams(window.location.search);
    const verified = params.get("license_verified");
    loadUser();
    if (verified === "1") setStatus("none");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit RCIC onboarding ───────────────────────────────────────────────
  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    const token = localStorage.getItem("wtc_consultant_token");
    try {
      const res  = await fetch(`${API}/consultant/onboarding`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          Accept:          "application/json",
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify({ rcic_number: rcicNumber, language }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? "Failed to submit. Please try again.");
        return;
      }

      if (data.status === "verified") {
        localStorage.setItem("wtc_consultant_user", JSON.stringify(data.user));
        setStatus("none");
      } else {
        setStatus("pending");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Refresh verification status ──────────────────────────────────────────
  function handleRefresh() {
    setRefreshing(true);
    loadUser(true); // force-refresh: skip cache, fetch live from backend
  }

  // ── Loading spinner (initial auth check) ─────────────────────────────────
  if (status === "loading") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  // ── No popup needed ───────────────────────────────────────────────────────
  if (status === "none") return null;

  // ── Popup overlay ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 space-y-6">

        {/* ── ONBOARDING FORM ── */}
        {status === "onboarding" && (
          <>
            {step === 1 ? (
              <>
                <div className="text-center space-y-2">
                  <Globe className="h-12 w-12 mx-auto text-blue-600" />
                  <h2 className="text-xl font-bold">Welcome! Choose Your Language</h2>
                  <p className="text-sm text-gray-500">
                    Select your preferred language for the consultant portal.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(["en", "fr"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`border-2 rounded-xl p-5 text-center font-semibold transition-colors focus:outline-none ${
                        language === lang
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    >
                      {lang === "en" ? "🇨🇦  English" : "🇫🇷  Français"}
                    </button>
                  ))}
                </div>

                <Button className="w-full" onClick={() => setStep(2)}>
                  Continue
                </Button>
              </>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <Shield className="h-12 w-12 mx-auto text-blue-600" />
                  <h2 className="text-xl font-bold">Verify Your RCIC Licence</h2>
                  <p className="text-sm text-gray-500">
                    Enter your CICC-issued registration number. We'll cross-check it with
                    the CICC public register.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rcic_number">RCIC Registration Number</Label>
                  <Input
                    id="rcic_number"
                    placeholder="e.g. R711248"
                    value={rcicNumber}
                    onChange={(e) => setRcicNumber(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter" && rcicNumber.trim()) handleSubmit(); }}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => { setStep(1); setError(""); }}>
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSubmit}
                    disabled={!rcicNumber.trim() || submitting}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Licence"}
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── PENDING VERIFICATION SCREEN ── */}
        {status === "pending" && (
          <div className="text-center space-y-5">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
              <Shield className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold">Verification Pending</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              A verification email has been sent to the address on file with CICC for your
              RCIC registration number. Please ask the licence holder to click the link in
              that email to complete verification.
            </p>
            <p className="text-xs text-gray-400">
              You'll gain full access to the consultant dashboard once verified.
            </p>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />}
              I've been verified — Check again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

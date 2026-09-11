"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

interface Props {
  sessionId: string;
}

type Step = "activating" | "success" | "error";

export function ReturnClient({ sessionId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("activating");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setErrorMsg("Missing checkout session ID. Please try again.");
      setStep("error");
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const token = localStorage.getItem("wtc_consultant_token");
        if (!token) {
          throw new Error("Please log in again, then open this return link or retry checkout.");
        }

        const res = await fetch(`${API}/consultant/payment/stripe/verify-session`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ session_id: sessionId }),
        });

        const raw = await res.text();
        let json: { message?: string } = {};
        try {
          json = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(raw?.slice(0, 180) || `Activation failed (HTTP ${res.status}).`);
        }

        if (!res.ok) {
          throw new Error(json?.message || `Activation failed (HTTP ${res.status}).`);
        }

        if (!cancelled) {
          setStep("success");
          setTimeout(() => router.replace("/dashboard/default"), 2800);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setErrorMsg(e instanceof Error ? e.message : "An unexpected error occurred.");
          setStep("error");
        }
      }
    }

    void verify();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ra-root ra-page">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&display=swap"
      />
      <style>{RA_CSS}</style>

      <div className="ra-shell">
        <div className="ra-card" role="status" aria-live="polite">
          <div className="ra-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/rcicmaster-logo.png" alt="RCICMASTER" />
          </div>

          {step === "activating" && (
            <div className="ra-body">
              <div className="ra-spinner">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <p className="ra-kicker">Almost there</p>
              <h1>Activating your subscription</h1>
              <p className="ra-copy">Confirming your payment with Stripe. This only takes a moment.</p>
            </div>
          )}

          {step === "success" && (
            <div className="ra-body">
              <div className="ra-success-mark" aria-hidden>
                <CheckCircle2 className="h-9 w-9" strokeWidth={2.25} />
              </div>
              <p className="ra-kicker">Payment confirmed</p>
              <h1>Subscription activated</h1>
              <p className="ra-copy">
                Your RCICMASTER workspace is ready. Taking you to the dashboard…
              </p>
              <div className="ra-progress" aria-hidden>
                <span />
              </div>
              <button
                type="button"
                className="ra-btn ra-btn--primary"
                onClick={() => router.replace("/dashboard/default")}
              >
                Go to dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="ra-body">
              <div className="ra-error-mark" aria-hidden>
                <AlertTriangle className="h-8 w-8" />
              </div>
              <p className="ra-kicker ra-kicker--error">Needs attention</p>
              <h1>Activation failed</h1>
              <p className="ra-copy">{errorMsg}</p>
              <div className="ra-actions">
                <button
                  type="button"
                  className="ra-btn ra-btn--primary"
                  onClick={() => router.push("/dashboard/subscribe")}
                >
                  Try checkout again
                </button>
                <button
                  type="button"
                  className="ra-btn ra-btn--ghost"
                  onClick={() => router.push("/dashboard/default")}
                >
                  Back to dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="ra-foot">© {new Date().getFullYear()} RCICMASTER · rcicmaster.ca</p>
      </div>
    </div>
  );
}

const RA_CSS = `
.ra-root {
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
.ra-root *, .ra-root *::before, .ra-root *::after { box-sizing: border-box; }

@keyframes ra-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes ra-bar {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

.ra-page {
  min-height: 100vh;
  background:
    radial-gradient(ellipse 70% 45% at 50% -15%, rgba(208, 29, 32, 0.08), transparent 55%),
    linear-gradient(180deg, #fafbfc 0%, #eef1f5 100%);
}

.ra-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  padding: 1.5rem 1rem 2rem;
}

.ra-card {
  width: 100%;
  max-width: 440px;
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(17, 19, 24, 0.08);
  overflow: hidden;
  animation: ra-in 0.45s ease both;
}

.ra-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.35rem 1.5rem 1rem;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, #fff 0%, var(--soft) 100%);
}

.ra-brand img {
  height: 40px;
  width: auto;
  display: block;
  object-fit: contain;
}

.ra-body {
  padding: 1.75rem 1.5rem 1.75rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ra-kicker {
  margin: 1rem 0 0.45rem;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--red);
}

.ra-kicker--error { color: var(--red-dark); }

.ra-body h1 {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.25;
}

.ra-copy {
  margin: 0.65rem 0 0;
  max-width: 28rem;
  font-size: 0.92rem;
  line-height: 1.55;
  font-weight: 500;
  color: var(--muted);
}

.ra-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: rgba(208, 29, 32, 0.06);
  color: var(--red);
  border: 1px solid rgba(208, 29, 32, 0.12);
}

.ra-success-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 999px;
  background: rgba(208, 29, 32, 0.08);
  color: var(--red);
  box-shadow: 0 0 0 8px rgba(208, 29, 32, 0.05);
}

.ra-error-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(208, 29, 32, 0.07);
  color: var(--red);
  border: 1px solid rgba(208, 29, 32, 0.14);
}

.ra-progress {
  width: 100%;
  max-width: 220px;
  height: 4px;
  margin: 1.35rem 0 1.15rem;
  border-radius: 999px;
  background: var(--soft);
  overflow: hidden;
}

.ra-progress span {
  display: block;
  height: 100%;
  width: 100%;
  transform-origin: left center;
  background: linear-gradient(90deg, var(--red-dark), var(--red));
  animation: ra-bar 2.6s ease forwards;
}

.ra-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-top: 1.35rem;
}

.ra-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: 100%;
  min-height: 46px;
  border-radius: 12px;
  border: 0;
  cursor: pointer;
  font: 700 0.9rem/1 Manrope, sans-serif;
  transition: background 0.15s, opacity 0.15s;
}

.ra-btn--primary {
  margin-top: 0.25rem;
  background: var(--red);
  color: #fff;
  box-shadow: 0 10px 22px rgba(208, 29, 32, 0.22);
}
.ra-btn--primary:hover { background: var(--red-dark); }

.ra-btn--ghost {
  background: var(--soft);
  color: var(--ink);
  border: 1px solid var(--line);
}
.ra-btn--ghost:hover { background: #eef0f4; }

.ra-foot {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: #98a2b3;
  animation: ra-in 0.5s ease 0.15s both;
}
`;

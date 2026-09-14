"use client";

import { useEffect, useState } from "react";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function token(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("wtc_consultant_token") ??
    localStorage.getItem("wtc_admin_token") ??
    localStorage.getItem("wtc_token")
  );
}

export function LocaleToggle() {
  const [locale, setLocale] = useState<"en" | "fr">("en");

  useEffect(() => {
    const stored = localStorage.getItem("wtc_locale");
    if (stored === "fr" || stored === "en") setLocale(stored);
    const auth = token();
    if (!auth) return;
    fetch(`${API}/me`, { headers: { Authorization: `Bearer ${auth}`, Accept: "application/json" } })
      .then((r) => r.json())
      .then((u) => {
        if (u.locale === "fr" || u.locale === "en") {
          setLocale(u.locale);
          localStorage.setItem("wtc_locale", u.locale);
        }
      })
      .catch(() => {});
  }, []);

  async function choose(next: "en" | "fr") {
    setLocale(next);
    localStorage.setItem("wtc_locale", next);
    window.dispatchEvent(new CustomEvent("wtc-locale", { detail: next }));
    const auth = token();
    if (!auth) return;
    await fetch(`${API}/me/locale`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${auth}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
  }

  return (
    <div className="inline-flex rounded-full border text-xs">
      <button type="button" className={`px-2 py-1 ${locale === "en" ? "font-semibold" : ""}`} onClick={() => choose("en")}>
        EN
      </button>
      <button type="button" className={`px-2 py-1 ${locale === "fr" ? "font-semibold" : ""}`} onClick={() => choose("fr")}>
        FR
      </button>
    </div>
  );
}

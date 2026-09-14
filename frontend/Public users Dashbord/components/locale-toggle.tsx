"use client";

import { useEffect, useState } from "react";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export function LocaleToggle() {
  const [locale, setLocale] = useState<"en" | "fr">("en");

  useEffect(() => {
    const stored = localStorage.getItem("wtc_locale");
    if (stored === "fr" || stored === "en") setLocale(stored);
    const token = localStorage.getItem("wtc_token");
    if (!token) return;
    fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } })
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
    const token = localStorage.getItem("wtc_token");
    if (!token) return;
    await fetch(`${API}/me/locale`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
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

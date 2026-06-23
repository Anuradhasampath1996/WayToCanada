"use client";

import * as React from "react";
import type { LegislationLink } from "@/components/legislation/legislation-link-chips";
import type { ResolvedProvision } from "@/components/legislation/legislation-provision-types";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("wtc_consultant_token") ??
        document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1] ??
        ""
      : "";
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function cacheKey(act: string, key: string, language: string): string {
  return `${act}::${key}::${language}`;
}

export function useLegislationProvisionPopup() {
  const cacheRef = React.useRef<Map<string, ResolvedProvision>>(new Map());
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [popup, setPopup] = React.useState<ResolvedProvision | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    setPopup(null);
    setError(null);
  }, []);

  const openLink = React.useCallback(async (link: LegislationLink, language = "en") => {
    const act = link.act_code ?? "";
    const key = link.provision_key ?? "";
    if (!act || !key) return;

    setOpen(true);
    setError(null);

    const ck = cacheKey(act, key, language);
    const cached = cacheRef.current.get(ck);
    if (cached) {
      setPopup(cached);
      return;
    }

    setPopup(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ act, key, language, summary: "1" });
      const res = await fetch(`${API}/legislation/resolve?${params}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Reference not found.");
        setPopup(null);
        return;
      }
      const data = json.data as ResolvedProvision;
      cacheRef.current.set(ck, data);
      setPopup(data);
    } catch {
      setError("Could not load this section.");
      setPopup(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    openLink,
    close,
    dialogState: {
      open,
      loading,
      popup,
      error,
      onClose: close,
    },
  };
}

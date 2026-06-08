"use client";

import * as React from "react";
import {
  buildClientJourney,
  buildClientActivity,
  canAccessNavStep,
  resolveClientNextAction,
  type ClientCaseFile,
  type ClientFormsVerification,
  type ClientJourneyMeta,
  type ClientNextAction,
  type ClientActivityEvent,
  type JourneyStep,
  type JourneyStepId,
} from "@/lib/client-journey";
import {
  buildClientQuestionnaireStats,
  type ClientQuestionnaireStats,
} from "@/lib/client-questionnaire-stats";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function getCookieToken(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)wtc_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function authHeaders(): Record<string, string> {
  const token =
    (typeof localStorage !== "undefined" ? localStorage.getItem("wtc_token") : null)
    ?? getCookieToken();
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface Consultant {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  rcic_number?: string | null;
  avatar?: string | null;
}

interface ClientInfo {
  name: string;
  email: string;
  immigration_pathway: string | null;
}

interface ApplicationPackage {
  id: number;
  label: string;
  interactive_forms?: unknown[];
}

type ClientJourneyContextValue = {
  loading: boolean;
  error: string;
  caseFile: ClientCaseFile | null;
  verification: ClientFormsVerification | null;
  consultant: Consultant | null;
  client: ClientInfo | null;
  applicationPackage: ApplicationPackage | null;
  qStats: ClientQuestionnaireStats;
  steps: JourneyStep[];
  currentStepId: JourneyStepId;
  progressPercent: number;
  meta: ClientJourneyMeta;
  nextAction: ClientNextAction;
  activityEvents: ClientActivityEvent[];
  refresh: () => Promise<void>;
  canAccess: (stepId: JourneyStepId) => boolean;
};

const ClientJourneyContext = React.createContext<ClientJourneyContextValue | null>(null);

export function ClientJourneyProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [caseFile, setCaseFile] = React.useState<ClientCaseFile | null>(null);
  const [verification, setVerification] = React.useState<ClientFormsVerification | null>(null);
  const [consultant, setConsultant] = React.useState<Consultant | null>(null);
  const [client, setClient] = React.useState<ClientInfo | null>(null);
  const [applicationPackage, setApplicationPackage] = React.useState<ApplicationPackage | null>(null);
  const [qStats, setQStats] = React.useState<ClientQuestionnaireStats>(buildClientQuestionnaireStats(null));

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!localStorage.getItem("wtc_token")) {
        const cookieMatch = document.cookie.match(/(?:^|;\s*)wtc_token=([^;]+)/);
        if (cookieMatch) localStorage.setItem("wtc_token", decodeURIComponent(cookieMatch[1]));
      }

      const [dashRes, qRes] = await Promise.all([
        fetch(`${API}/client/dashboard`, { headers: authHeaders() }),
        fetch(`${API}/questionnaire`, { headers: authHeaders() }),
      ]);

      const json = await dashRes.json();
      if (!dashRes.ok) throw new Error(json?.message ?? "Failed to load dashboard.");

      setCaseFile(json.case_file ?? null);
      setVerification(json.application_forms_verification ?? null);
      setConsultant(json.consultant ?? null);
      setClient(json.client ?? null);
      setApplicationPackage(json.application_package ?? null);

      if (qRes.ok) {
        const qJson = await qRes.json();
        setQStats(buildClientQuestionnaireStats(qJson.data));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const hasForms = (applicationPackage?.interactive_forms?.length ?? 0) > 0;
  const { steps, currentStepId, progressPercent, meta } = buildClientJourney(
    caseFile,
    verification,
    hasForms,
    qStats,
  );
  const nextAction = resolveClientNextAction(caseFile, verification, qStats, hasForms, meta);
  const activityEvents = buildClientActivity(caseFile, verification, qStats);

  const canAccess = React.useCallback(
    (stepId: JourneyStepId) => canAccessNavStep(stepId, caseFile, verification),
    [caseFile, verification],
  );

  const value: ClientJourneyContextValue = {
    loading,
    error,
    caseFile,
    verification,
    consultant,
    client,
    applicationPackage,
    qStats,
    steps,
    currentStepId,
    progressPercent,
    meta,
    nextAction,
    activityEvents,
    refresh,
    canAccess,
  };

  return (
    <ClientJourneyContext.Provider value={value}>
      {children}
    </ClientJourneyContext.Provider>
  );
}

export function useClientJourney() {
  const ctx = React.useContext(ClientJourneyContext);
  if (!ctx) throw new Error("useClientJourney must be used within ClientJourneyProvider");
  return ctx;
}

export function useClientJourneyOptional() {
  return React.useContext(ClientJourneyContext);
}

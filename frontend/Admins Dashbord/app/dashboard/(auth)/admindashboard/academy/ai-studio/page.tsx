"use client";

import { useEffect, useState } from "react";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function headers() {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_admin_token=([^;]+)/)?.[1]
      : undefined) ?? (typeof window !== "undefined" ? localStorage.getItem("wtc_admin_token") : null);
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const TABS = [
  "generate-course",
  "generate-questions",
  "generate-cases",
  "generate-mock-pool",
  "jobs",
  "review-queue",
  "settings",
  "usage",
] as const;

export default function AcademyAiStudioPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("generate-course");
  const [payload, setPayload] = useState<unknown>(null);
  const [title, setTitle] = useState("RCIC-IRB Specialization Exam Mastery");
  const [goal, setGoal] = useState("Draft exam-prep study aid. Not official CICC material.");
  const [independent, setIndependent] = useState(2);
  const [caseBased, setCaseBased] = useState(2);
  const [images, setImages] = useState(false);

  async function load(path: string, init?: RequestInit) {
    const res = await fetch(`${API}/admin/academy/ai/${path}`, { headers: headers(), ...init });
    const json = await res.json();
    setPayload(json);
    return json;
  }

  useEffect(() => {
    load("bootstrap");
  }, []);

  function jobBody(type: string, extra: Record<string, unknown> = {}) {
    return {
      type,
      title,
      goal,
      independent_count: independent,
      case_based_count: caseBased,
      generate_images: images,
      difficulty_mix: { easy: 1, medium: 1, hard: 0 },
      ...extra,
    };
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Content Studio</h1>
        <p className="text-sm text-muted-foreground">
          Generate Academy drafts only. AI cannot publish. Human content review and RCIC/legal review remain required.
          Not official CICC exam material. Do not claim 100% AI accuracy.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item}
            className="rounded border px-3 py-1 text-sm capitalize"
            onClick={() => {
              setTab(item);
              if (item === "jobs") load("jobs");
              if (item === "review-queue") load("review-queue");
              if (item === "settings") load("settings");
              if (item === "usage") load("usage");
            }}
          >
            {item.replaceAll("-", " ")}
          </button>
        ))}
      </div>

      {["generate-course", "generate-questions", "generate-cases", "generate-mock-pool"].includes(tab) && (
        <div className="flex flex-wrap gap-2">
          <input className="rounded border px-2 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="w-72 rounded border px-2 py-1 text-sm" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <input
            type="number"
            className="w-24 rounded border px-2 py-1 text-sm"
            value={independent}
            onChange={(e) => setIndependent(Number(e.target.value))}
          />
          <input
            type="number"
            className="w-24 rounded border px-2 py-1 text-sm"
            value={caseBased}
            onChange={(e) => setCaseBased(Number(e.target.value))}
          />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={images} onChange={(e) => setImages(e.target.checked)} />
            Generate images
          </label>
        </div>
      )}

      {tab === "generate-course" && (
        <div className="flex gap-2">
          <button
            className="rounded border px-3 py-1 text-sm"
            onClick={() =>
              load("jobs", {
                method: "POST",
                body: JSON.stringify(jobBody("course", { generate_blueprint_only: true })),
              })
            }
          >
            Generate Blueprint
          </button>
          <button
            className="rounded border px-3 py-1 text-sm"
            onClick={async () => {
              const current = payload as { job?: { id?: number } } | null;
              const id = current?.job?.id;
              if (!id) return;
              await load(`jobs/${id}/approve-blueprint`, { method: "POST" });
            }}
          >
            Approve Blueprint & Generate Draft
          </button>
        </div>
      )}

      {tab === "generate-questions" && (
        <button
          className="rounded border px-3 py-1 text-sm"
          onClick={() =>
            load("jobs", {
              method: "POST",
              body: JSON.stringify(jobBody("questions", { generate_cases: false, generate_case_mcqs: false })),
            })
          }
        >
          Generate independent MCQ drafts
        </button>
      )}

      {tab === "generate-cases" && (
        <button
          className="rounded border px-3 py-1 text-sm"
          onClick={() => load("jobs", { method: "POST", body: JSON.stringify(jobBody("cases")) })}
        >
          Generate case drafts
        </button>
      )}

      {tab === "generate-mock-pool" && (
        <button
          className="rounded border px-3 py-1 text-sm"
          onClick={() =>
            load("jobs", {
              method: "POST",
              body: JSON.stringify(
                jobBody("mock_pool", {
                  independent_count: independent || 300,
                  case_based_count: caseBased || 300,
                })
              ),
            })
          }
        >
          Generate reviewed question pool
        </button>
      )}

      <pre className="overflow-auto rounded border p-3 text-xs">{JSON.stringify(payload, null, 2)}</pre>
    </div>
  );
}

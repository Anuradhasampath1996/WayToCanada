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

export default function AdminAcademyPage() {
  const [tab, setTab] = useState("dashboard");
  const [payload, setPayload] = useState<unknown>(null);
  const [title, setTitle] = useState("IRB Foundations Lesson");

  async function load(path: string) {
    const res = await fetch(`${API}/admin/academy/${path}`, { headers: headers() });
    setPayload(await res.json());
  }

  useEffect(() => {
    load("dashboard");
  }, []);

  async function createCourse() {
    const res = await fetch(`${API}/admin/academy/courses`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ title, access_tier: "subscription" }),
    });
    setPayload(await res.json());
  }

  const tabs = [
    "dashboard",
    "courses",
    "questions",
    "cases",
    "exam-templates",
    "topics",
    "competencies",
    "sources",
    "reports",
    "outdated",
    "analytics",
  ];

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">RCIC Academy</h1>
        <p className="text-sm text-muted-foreground">
          Professional learning CMS. Question Bank, review workflow, and exam templates live here — not in client LMS
          Management.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            className="rounded border px-3 py-1 text-sm capitalize"
            onClick={() => {
              setTab(item);
              load(item === "exam-templates" ? "exam-templates" : item);
            }}
          >
            {item === "questions" ? "Question Bank" : item.replace("-", " ")}
          </button>
        ))}
      </div>
      {tab === "courses" && (
        <div className="flex gap-2">
          <input className="rounded border px-2 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="rounded border px-3 py-1 text-sm" onClick={createCourse}>
            Create draft course
          </button>
        </div>
      )}
      <pre className="overflow-auto rounded border p-3 text-xs">{JSON.stringify(payload, null, 2)}</pre>
    </div>
  );
}

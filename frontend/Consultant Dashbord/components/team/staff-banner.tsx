"use client";

import { useEffect, useState } from "react";
import { readTeamSession, type TeamSession } from "@/lib/team-access";

export function StaffBanner() {
  const [session, setSession] = useState<TeamSession | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("wtc_consultant_user");
      if (raw) setSession(readTeamSession(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);

  if (session?.actor_type !== "staff") return null;

  const title = session.job_title || session.preset_key || "Team member";
  const firm = session.workspace?.firm_name || session.workspace?.owner_name || "this practice";

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      Team Member — {title} · {firm}. Licensed consultant actions stay with the owner.
    </div>
  );
}

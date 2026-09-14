"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("wtc_consultant_token") ?? "";
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type Assignment = {
  id: number;
  member_id: number;
  assignment_role: string;
  member: { name?: string; email?: string };
};

type Member = { id: number; name?: string; email?: string; assignment_count: number };

export function CaseTeamCard({ profileId }: { profileId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberId] = useState("");
  const [visible, setVisible] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/team`, { headers: authHeaders() });
    if (res.status === 403) {
      setVisible(false);
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setAssignments(data.assignments ?? []);
    setMembers(data.members ?? []);
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!visible) return null;

  async function assign() {
    if (!memberId) return;
    await fetch(`${API}/consultant/clients/${profileId}/case-file/team`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ member_id: Number(memberId), assignment_role: "collaborator" }),
    });
    setMemberId("");
    await load();
  }

  async function remove(id: number) {
    await fetch(`${API}/consultant/clients/${profileId}/case-file/team/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    await load();
  }

  return (
    <section className="mt-4 rounded-xl border bg-card p-3">
      <h3 className="mb-2 text-sm font-semibold">Team</h3>
      <ul className="mb-3 space-y-1 text-sm">
        {assignments.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2">
            <span>{row.member?.name ?? row.member?.email} · {row.assignment_role.replaceAll("_", " ")}</span>
            <Button size="sm" variant="ghost" onClick={() => void remove(row.member_id)}>Remove</Button>
          </li>
        ))}
        {assignments.length === 0 ? <li className="text-muted-foreground">No staff assigned.</li> : null}
      </ul>
      {members.length > 0 ? (
        <div className="flex gap-2">
          <select className="h-9 flex-1 rounded-md border bg-background px-2 text-sm" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Assign staff…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.assignment_count} cases)</option>
            ))}
          </select>
          <Button size="sm" onClick={() => void assign()} disabled={!memberId}>Assign</Button>
        </div>
      ) : null}
    </section>
  );
}

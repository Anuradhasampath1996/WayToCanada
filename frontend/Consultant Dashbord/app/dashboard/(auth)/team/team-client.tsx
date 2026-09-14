"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OWNER_ONLY_LABELS, PERMISSION_GROUPS } from "@/lib/team-access";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(): Record<string, string> {
  const raw =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ?? localStorage.getItem("wtc_consultant_token") ?? "";
  let token = raw;
  try {
    token = raw ? decodeURIComponent(raw) : "";
  } catch {
    token = raw;
  }
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type Member = {
  id: number;
  name: string;
  email: string;
  job_title: string | null;
  preset_key: string | null;
  access_scope: string;
  status: string;
  last_login_at: string | null;
  permissions: Record<string, boolean>;
  assignment_count: number;
};

type Invitation = {
  id: number;
  name: string;
  email: string;
  preset_key: string | null;
  access_scope: string;
  status: string;
  expires_at: string | null;
};

type Preset = { key: string; name: string; permissions: Record<string, boolean> };

const emptyPermissions = () =>
  Object.fromEntries(PERMISSION_GROUPS.flatMap((g) => g.keys.map((k) => [k, false]))) as Record<string, boolean>;

export function TeamClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activity, setActivity] = useState<Array<{ id: number; action: string; created_at: string }>>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [presetKey, setPresetKey] = useState("case_worker");
  const [scope, setScope] = useState("assigned_cases");
  const [permissions, setPermissions] = useState<Record<string, boolean>>(emptyPermissions);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [teamRes, presetRes, activityRes] = await Promise.all([
        fetch(`${API}/consultant/team`, { headers: authHeaders() }),
        fetch(`${API}/consultant/team/presets`, { headers: authHeaders() }),
        fetch(`${API}/consultant/team/activity`, { headers: authHeaders() }),
      ]);
      if (!teamRes.ok) {
        setError("Only the licensed consultant can manage the team.");
        return;
      }
      const team = await teamRes.json();
      const presetJson = await presetRes.json();
      const activityJson = await activityRes.json();
      setMembers(team.members ?? []);
      setInvitations(team.invitations ?? []);
      setPresets(presetJson.presets ?? []);
      setActivity(activityJson.data ?? []);
    } catch {
      setError("Could not load team data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const preset = presets.find((p) => p.key === presetKey);
    if (preset) {
      setPermissions({ ...emptyPermissions(), ...preset.permissions });
    }
  }, [presetKey, presets]);

  const pendingInvites = useMemo(
    () => invitations.filter((i) => i.status === "sent"),
    [invitations],
  );

  async function sendInvite() {
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/team/invitations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name,
          email,
          job_title: jobTitle,
          preset_key: presetKey,
          access_scope: scope,
          permissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.errors?.email?.[0] ?? data?.message ?? "Could not send invitation.");
        return;
      }
      setName("");
      setEmail("");
      setJobTitle("");
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setSending(false);
    }
  }

  async function memberAction(id: number, action: string) {
    await fetch(`${API}/consultant/team/members/${id}/${action}`, {
      method: "POST",
      headers: authHeaders(),
    });
    await load();
  }

  async function invitationAction(id: number, action: "resend" | "cancel") {
    if (action === "cancel") {
      await fetch(`${API}/consultant/team/invitations/${id}`, { method: "DELETE", headers: authHeaders() });
    } else {
      await fetch(`${API}/consultant/team/invitations/${id}/resend`, { method: "POST", headers: authHeaders() });
    }
    await load();
  }

  if (loading) {
    return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading team…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          <Users className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Team Management</h1>
          <p className="text-sm text-muted-foreground">
            Invite staff with their own login. Presets are starting templates — customize every permission before you send.
          </p>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="presets">Presets</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 space-y-4">
            <h2 className="font-medium">Invite a staff member</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Job title</Label>
                <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Preset</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
                  {presets.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Access scope</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="all_cases">All cases</option>
                  <option value="assigned_cases">Assigned cases</option>
                  <option value="selected_cases">Selected cases + assignments</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.title} className="rounded-xl border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
                  <div className="space-y-1.5">
                    {group.keys.map((key) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(permissions[key])}
                          onChange={(e) => setPermissions((prev) => ({ ...prev, [key]: e.target.checked }))}
                        />
                        {key}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-dashed p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consultant only</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {OWNER_ONLY_LABELS.map((label) => (
                    <li key={label} className="flex items-center gap-2">
                      <input type="checkbox" disabled />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <Button disabled={!name || !email || sending} onClick={() => void sendInvite()}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send invitation
            </Button>
          </section>

          <div className="overflow-hidden rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Member</th>
                  <th className="p-3">Scope</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Cases</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-muted-foreground">{m.email}</div>
                    </td>
                    <td className="p-3">{m.access_scope}</td>
                    <td className="p-3"><Badge variant="outline">{m.status}</Badge></td>
                    <td className="p-3">{m.assignment_count}</td>
                    <td className="p-3 text-right space-x-2">
                      {m.status === "active" ? (
                        <Button size="sm" variant="outline" onClick={() => void memberAction(m.id, "deactivate")}>Deactivate</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => void memberAction(m.id, "reactivate")}>Reactivate</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => void memberAction(m.id, "revoke-sessions")}>Revoke sessions</Button>
                    </td>
                  </tr>
                ))}
                {members.length === 0 ? (
                  <tr><td className="p-6 text-muted-foreground" colSpan={5}>No staff members yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="invitations">
          <div className="overflow-hidden rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Invitee</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Expires</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{i.name}</div>
                      <div className="text-muted-foreground">{i.email}</div>
                    </td>
                    <td className="p-3"><Badge variant="outline">{i.status}</Badge></td>
                    <td className="p-3">{i.expires_at ? new Date(i.expires_at).toLocaleString() : "—"}</td>
                    <td className="p-3 text-right space-x-2">
                      {i.status === "sent" ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => void invitationAction(i.id, "resend")}>Resend</Button>
                          <Button size="sm" variant="ghost" onClick={() => void invitationAction(i.id, "cancel")}>Cancel</Button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {pendingInvites.length === 0 && invitations.length === 0 ? (
                  <tr><td className="p-6 text-muted-foreground" colSpan={4}>No invitations yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="presets" className="grid gap-3 md:grid-cols-2">
          {presets.map((p) => (
            <article key={p.key} className="rounded-2xl border p-4">
              <h3 className="font-medium">{p.name}</h3>
              <p className="mb-2 text-xs text-muted-foreground">Template only. You can change every box before sending.</p>
              <ul className="text-sm text-muted-foreground">
                {Object.entries(p.permissions).filter(([, on]) => on).map(([key]) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="activity">
          <ul className="space-y-2 text-sm">
            {activity.map((event) => (
              <li key={event.id} className="rounded-xl border px-3 py-2">
                <span className="font-medium">{event.action}</span>
                <span className="ml-2 text-muted-foreground">{event.created_at}</span>
              </li>
            ))}
            {activity.length === 0 ? <li className="text-muted-foreground">No team activity yet.</li> : null}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminAuthHeaders } from "@/lib/admin-auth";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type Screen = "settings" | "referrals" | "ledger" | "withdrawals" | "review";

export function ReferralProgramClient({ screen }: { screen: Screen }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState({
    program_enabled: true,
    reward_value: 50,
    hold_days: 14,
    withdrawal_minimum: 50,
    wallet_credit_enabled: true,
    terms_markdown: "",
  });
  const [rows, setRows] = useState<any[]>([]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      if (screen === "settings") {
        const res = await fetch(`${API}/admin/referral-program/settings`, { headers: adminAuthHeaders() });
        const data = await res.json();
        setSettings({ ...settings, ...data.settings });
      } else {
        const path =
          screen === "referrals"
            ? "referrals"
            : screen === "ledger"
              ? "ledger"
              : screen === "withdrawals"
                ? "withdrawals"
                : "risk-flags";
        const res = await fetch(`${API}/admin/referral-program/${path}`, { headers: adminAuthHeaders() });
        const data = await res.json();
        setRows(data.data ?? []);
      }
    } catch {
      setError("Could not load referral program data.");
    } finally {
      setLoading(false);
    }
  }, [screen]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API}/admin/referral-program/settings`, {
      method: "PUT",
        headers: adminAuthHeaders("application/json"),
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      setError("Could not save settings.");
      return;
    }
    await load();
  }

  async function act(path: string, body?: Record<string, string>) {
    const res = await fetch(`${API}/admin/referral-program/${path}`, {
      method: "POST",
      headers: adminAuthHeaders("application/json"),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 409) {
      setError("This withdrawal was already marked paid.");
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <NavLink href="/admindashboard/referral-program/settings" active={screen === "settings"}>
          Settings
        </NavLink>
        <NavLink href="/admindashboard/referral-program/referrals" active={screen === "referrals"}>
          Referrals
        </NavLink>
        <NavLink href="/admindashboard/referral-program/ledger" active={screen === "ledger"}>
          Ledger
        </NavLink>
        <NavLink href="/admindashboard/referral-program/withdrawals" active={screen === "withdrawals"}>
          Withdrawals
        </NavLink>
        <NavLink href="/admindashboard/referral-program/review" active={screen === "review"}>
          Review
        </NavLink>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {screen === "settings" ? (
        <form onSubmit={saveSettings} className="max-w-2xl space-y-4 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <Label>Program enabled</Label>
            <Switch
              checked={settings.program_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, program_enabled: v })}
            />
          </div>
          <div>
            <Label>Reward (CAD)</Label>
            <Input
              type="number"
              value={settings.reward_value}
              onChange={(e) => setSettings({ ...settings, reward_value: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Hold days</Label>
            <Input
              type="number"
              value={settings.hold_days}
              onChange={(e) => setSettings({ ...settings, hold_days: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Withdrawal minimum</Label>
            <Input
              type="number"
              value={settings.withdrawal_minimum}
              onChange={(e) => setSettings({ ...settings, withdrawal_minimum: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Wallet credit on renewals</Label>
            <Switch
              checked={settings.wallet_credit_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, wallet_credit_enabled: v })}
            />
          </div>
          <div>
            <Label>Terms (draft)</Label>
            <textarea
              className="mt-1 w-full min-h-40 rounded-md border bg-background p-2 text-sm"
              value={settings.terms_markdown}
              onChange={(e) => setSettings({ ...settings, terms_markdown: e.target.value })}
            />
          </div>
          <Button type="submit">Publish new version</Button>
        </form>
      ) : null}

      {screen === "referrals" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referrer</TableHead>
              <TableHead>Referred</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reward</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.referrer?.name}</TableCell>
                <TableCell>{row.referred?.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{row.status}</Badge>
                </TableCell>
                <TableCell>
                  {row.reward_status ?? "—"} {row.reward_amount != null ? `CAD ${row.reward_amount}` : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      {screen === "ledger" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                <TableCell>{row.user_id}</TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell>
                  {row.direction} CAD {row.amount}
                </TableCell>
                <TableCell>{row.created_at}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      {screen === "withdrawals" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Consultant</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.user?.name}</TableCell>
                <TableCell>CAD {row.amount}</TableCell>
                <TableCell>
                  {row.bank_name} {row.account_masked}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{row.status}</Badge>
                </TableCell>
                <TableCell className="space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => void act(`withdrawals/${row.id}/review`)}>
                    Review
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void act(`withdrawals/${row.id}/approve`)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void act(`withdrawals/${row.id}/reject`)}>
                    Reject
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void act(`withdrawals/${row.id}/processing`)}>
                    Processing
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const ref = window.prompt("Payout reference");
                      if (ref) void act(`withdrawals/${row.id}/paid`, { payout_reference: ref });
                    }}
                  >
                    Mark paid
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      {screen === "review" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.code}</TableCell>
                <TableCell>{row.severity}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>
                  {row.status === "open" ? (
                    <Button size="sm" variant="outline" onClick={() => void act(`risk-flags/${row.id}/clear`)}>
                      Clear
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-md bg-primary px-3 py-1 text-primary-foreground"
          : "rounded-md border px-3 py-1 text-muted-foreground"
      }
    >
      {children}
    </Link>
  );
}

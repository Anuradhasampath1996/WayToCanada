"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Gift, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { referralRewardCopy } from "@/lib/referral-wallet";

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

type Overview = {
  code: string;
  link: string;
  program_enabled: boolean;
  reward_value: number;
  hold_days: number;
  withdrawal_minimum: number;
  wallet_credit_enabled: boolean;
  stats: Record<string, number>;
  wallet: {
    pending_rewards: number;
    available_balance: number;
    reserved_for_withdrawal: number;
    spendable_balance: number;
    lifetime_earned: number;
    lifetime_subscription_credits: number;
    lifetime_withdrawn: number;
    auto_use_wallet_on_renewal: boolean;
    withdrawals_frozen: boolean;
  };
};

type ReferralRow = {
  id: number;
  referred_first_name: string;
  registered_at: string | null;
  status: string;
  verified: boolean;
  reward_status: string | null;
  reward_amount: number | null;
};

type TxRow = {
  id: number;
  type: string;
  direction: string;
  amount: number;
  description: string | null;
  created_at: string | null;
};

type WithdrawalRow = {
  id: number;
  amount: number;
  status: string;
  account_masked: string;
  payout_reference: string | null;
  requested_at: string | null;
  cancellable: boolean;
};

function money(value: number): string {
  return `CAD ${value.toFixed(2)}`;
}

export function ReferralsClient() {
  const search = useSearchParams();
  const initialTab = search.get("tab") ?? "overview";
  const [overview, setOverview] = useState<Overview | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [terms, setTerms] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    amount: "",
    account_holder_name: "",
    bank_name: "",
    account_number: "",
    transit_number: "",
    institution_number: "",
    consultant_note: "",
  });

  const load = useCallback(async () => {
    setError("");
    const [ov, refs, txs, wds, tm] = await Promise.all([
      fetch(`${API}/consultant/referral`, { headers: authHeaders() }),
      fetch(`${API}/consultant/referrals`, { headers: authHeaders() }),
      fetch(`${API}/consultant/wallet/transactions`, { headers: authHeaders() }),
      fetch(`${API}/consultant/withdrawals`, { headers: authHeaders() }),
      fetch(`${API}/consultant/referral/terms`, { headers: authHeaders() }),
    ]);
    if (!ov.ok) {
      setError("Could not load your referral wallet.");
      setLoading(false);
      return;
    }
    setOverview(await ov.json());
    setReferrals((await refs.json()).data ?? []);
    setTransactions((await txs.json()).data ?? []);
    setWithdrawals((await wds.json()).data ?? []);
    setTerms((await tm.json()).terms_markdown ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = overview?.stats;
  const wallet = overview?.wallet;

  async function copyLink() {
    if (!overview?.link) return;
    await navigator.clipboard.writeText(overview.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function toggleCredit(next: boolean) {
    await fetch(`${API}/consultant/wallet/credit-preference`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ auto_use_wallet_on_renewal: next }),
    });
    await load();
  }

  async function requestWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`${API}/consultant/withdrawals`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        country: "CA",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.message ?? data?.errors?.amount?.[0] ?? "Could not request withdrawal.");
      return;
    }
    setForm({
      amount: "",
      account_holder_name: "",
      bank_name: "",
      account_number: "",
      transit_number: "",
      institution_number: "",
      consultant_note: "",
    });
    await load();
  }

  async function cancelWithdrawal(id: number) {
    await fetch(`${API}/consultant/withdrawals/${id}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    await load();
  }

  const cards = useMemo(
    () => [
      ["Total referrals", stats?.total_referrals ?? 0],
      ["Verified", stats?.verified ?? 0],
      ["Successful paid", stats?.successful_paid ?? 0],
      ["Pending rewards", money(stats?.pending_rewards ?? 0)],
      ["Available", money(stats?.available_balance ?? 0)],
      ["Spendable", money(stats?.spendable_balance ?? 0)],
    ],
    [stats],
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading referrals…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Gift className="h-6 w-6" /> Referrals & Wallet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Earn {money(overview?.reward_value ?? 50)} when a referred consultant completes their first eligible paid
            platform subscription. Clicks, registration, RCIC verification, and free trials do not create a reward.
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Tabs defaultValue={["overview", "referrals", "wallet", "withdrawals"].includes(initialTab) ? initialTab : "overview"}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="rounded-xl border p-4 space-y-3">
            <Label>Your referral link</Label>
            <div className="flex gap-2">
              <Input readOnly value={overview?.link ?? ""} />
              <Button type="button" onClick={copyLink} variant="outline">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link. Reward holds for {overview?.hold_days ?? 14} days after the first paid subscription.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {cards.map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold mt-1">{value}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="referrals">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultant</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reward</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    No referrals yet.
                  </TableCell>
                </TableRow>
              ) : (
                referrals.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.referred_first_name}</TableCell>
                    <TableCell>{row.registered_at ? new Date(row.registered_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {referralRewardCopy(row.reward_status)}
                      {row.reward_amount != null ? ` · ${money(row.reward_amount)}` : ""}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Pending rewards</p>
              <p className="text-lg font-semibold">{money(wallet?.pending_rewards ?? 0)}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-lg font-semibold">{money(wallet?.available_balance ?? 0)}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Reserved for withdrawal</p>
              <p className="text-lg font-semibold">{money(wallet?.reserved_for_withdrawal ?? 0)}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Spendable</p>
              <p className="text-lg font-semibold">{money(wallet?.spendable_balance ?? 0)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <Label className="flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Automatically use wallet credit on my next platform renewal
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Applies only to your RCICMaster platform renewal invoice. Marketing and storage invoices are never credited.
              </p>
            </div>
            <Switch
              checked={!!wallet?.auto_use_wallet_on_renewal}
              onCheckedChange={(v) => void toggleCredit(v)}
              disabled={!overview?.wallet_credit_enabled}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{tx.created_at ? new Date(tx.created_at).toLocaleString() : "—"}</TableCell>
                  <TableCell>{tx.type}</TableCell>
                  <TableCell>
                    {tx.direction === "debit" ? "−" : "+"}
                    {money(tx.amount)}
                  </TableCell>
                  <TableCell>{tx.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <details className="rounded-xl border p-4 text-sm">
            <summary className="cursor-pointer font-medium">Program terms (draft)</summary>
            <p className="text-xs text-amber-700 mt-2">Draft for legal/admin review — not final policy.</p>
            <pre className="whitespace-pre-wrap mt-3 text-xs text-muted-foreground">{terms}</pre>
          </details>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-6">
          <form onSubmit={requestWithdrawal} className="rounded-xl border p-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 text-sm text-muted-foreground">
              Minimum withdrawal {money(overview?.withdrawal_minimum ?? 50)}. You can cancel only before admin approval.
              {wallet?.withdrawals_frozen ? " Withdrawals are frozen pending admin review." : ""}
            </div>
            <div>
              <Label>Amount (CAD)</Label>
              <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div>
              <Label>Account holder</Label>
              <Input
                value={form.account_holder_name}
                onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Bank name</Label>
              <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} required />
            </div>
            <div>
              <Label>Account number</Label>
              <Input
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Transit number</Label>
              <Input value={form.transit_number} onChange={(e) => setForm({ ...form, transit_number: e.target.value })} />
            </div>
            <div>
              <Label>Institution number</Label>
              <Input
                value={form.institution_number}
                onChange={(e) => setForm({ ...form, institution_number: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Note</Label>
              <Input value={form.consultant_note} onChange={(e) => setForm({ ...form, consultant_note: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={!!wallet?.withdrawals_frozen}>
                Request withdrawal
              </Button>
            </div>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.requested_at ? new Date(row.requested_at).toLocaleString() : "—"}</TableCell>
                  <TableCell>{money(row.amount)}</TableCell>
                  <TableCell>{row.account_masked}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.status}</Badge>
                    {row.payout_reference ? ` · ${row.payout_reference}` : ""}
                  </TableCell>
                  <TableCell>
                    {row.cancellable ? (
                      <Button size="sm" variant="ghost" onClick={() => void cancelWithdrawal(row.id)}>
                        Cancel
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}

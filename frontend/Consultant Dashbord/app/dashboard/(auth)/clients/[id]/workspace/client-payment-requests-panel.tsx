"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DollarSign, Loader2, Plus, Send, Copy, CheckCircle2, XCircle, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type PaymentRequest = {
  id: number;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  pay_url: string;
  paid_at: string | null;
  sent_at: string | null;
  created_at: string;
};

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const STATUS_BADGE: Record<string, { label: string; className?: string }> = {
  pending: { label: "Pending", className: "bg-amber-500" },
  awaiting_confirmation: { label: "Awaiting confirmation", className: "bg-blue-600" },
  paid: { label: "Paid", className: "bg-emerald-600" },
  cancelled: { label: "Cancelled", className: "" },
};

export function ClientPaymentRequestsPanel({
  clientId,
  embedded = false,
}: {
  clientId: number;
  embedded?: boolean;
}) {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    amount: "",
    provider: "stripe",
    payment_purpose: "general" as "general" | "trust_deposit",
  });

  const load = useCallback(async () => {
    const res = await fetch(`${API}/consultant/clients/${clientId}/payment-requests`, { headers: authHeaders() });
    const data = await res.json();
    setRequests(data.data ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function sendRequest() {
    if (!form.title.trim() || !form.amount) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API}/consultant/clients/${clientId}/payment-requests`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          amount: Number(form.amount),
          provider: form.provider,
          payment_purpose: form.payment_purpose,
          send_email: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to send payment request");
      setOpen(false);
      setForm({ title: "", description: "", amount: "", provider: "stripe", payment_purpose: "general" });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send payment request");
    } finally {
      setSending(false);
    }
  }

  async function copyLink(url: string, id: number) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function resend(id: number) {
    await fetch(`${API}/consultant/clients/${clientId}/payment-requests/${id}/resend`, {
      method: "POST",
      headers: authHeaders(),
    });
    await load();
  }

  async function markPaid(id: number) {
    await fetch(`${API}/consultant/clients/${clientId}/payment-requests/${id}/mark-paid`, {
      method: "POST",
      headers: authHeaders(),
    });
    await load();
  }

  async function cancel(id: number) {
    await fetch(`${API}/consultant/clients/${clientId}/payment-requests/${id}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    await load();
  }

  const newRequestButton = (
    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 shrink-0" onClick={() => setOpen(true)}>
      <Plus className="h-4 w-4 mr-1" /> New request
    </Button>
  );

  const list = (
    <>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}
        {!loading && requests.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
            No payment requests yet. Connect Stripe, PayPal, or Interac in Account settings, then send your first request.
          </p>
        )}
        {requests.map((r) => {
          const badge = STATUS_BADGE[r.status] ?? { label: r.status };
          return (
            <div key={r.id} className="rounded-xl border p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-lg font-bold text-emerald-700 mt-0.5">
                    ${r.amount.toFixed(2)} {r.currency}
                  </p>
                  {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                </div>
                <Badge className={cn("capitalize", badge.className)} variant={badge.className ? "default" : "secondary"}>
                  {badge.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="capitalize">{r.provider}</span>
                {r.sent_at && <span>· Sent {new Date(r.sent_at).toLocaleDateString()}</span>}
                {r.paid_at && <span>· Paid {new Date(r.paid_at).toLocaleDateString()}</span>}
              </div>
              {r.status !== "cancelled" && r.status !== "paid" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyLink(r.pay_url, r.id)}>
                    {copiedId === r.id ? <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    {copiedId === r.id ? "Copied" : "Copy link"}
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={r.pay_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resend(r.id)}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Resend email
                  </Button>
                  {(r.status === "awaiting_confirmation" || r.provider !== "stripe") && (
                    <Button size="sm" variant="outline" onClick={() => markPaid(r.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark paid
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => cancel(r.id)}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                </div>
              )}
            </div>
          );
        })}
    </>
  );

  const dialog = (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send payment request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Title (e.g. Retainer — Milestone 1)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input type="number" min="1" step="0.01" placeholder="Amount (CAD)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stripe">Stripe (card)</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="interac">Interac e-Transfer</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={form.payment_purpose}
              onValueChange={(v) => setForm({ ...form, payment_purpose: v as "general" | "trust_deposit" })}
            >
              <SelectTrigger><SelectValue placeholder="Payment type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General payment (operating)</SelectItem>
                <SelectItem value="trust_deposit">Trust deposit (client trust ledger)</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={sendRequest} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Send to client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">{newRequestButton}</div>
        <div className="space-y-3">{list}</div>
        {dialog}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Payment requests
          </CardTitle>
          <CardDescription>
            Send a secure payment link to your client at any stage of the case.
          </CardDescription>
        </div>
        {newRequestButton}
      </CardHeader>
      <CardContent className="space-y-3">{list}</CardContent>
      {dialog}
    </Card>
  );
}

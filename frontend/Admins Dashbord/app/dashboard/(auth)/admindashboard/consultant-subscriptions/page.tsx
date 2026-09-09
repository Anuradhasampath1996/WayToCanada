"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Infinity,
  Loader2,
  RefreshCw,
  Search,
  TimerOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type SubRow = {
  id: number;
  status: string;
  is_trial: boolean;
  billing_cycle: string | null;
  starts_at: string | null;
  ends_at: string | null;
  trial_ends_at: string | null;
  is_lifetime: boolean;
  access_active: boolean;
  stripe_subscription_id: string | null;
  user: { id: number; name: string; email: string; role: string } | null;
  package: { id: number; name: string } | null;
};

type Stats = {
  total: number;
  active: number;
  trial: number;
  expired: number;
  lifetime: number;
};

type ExpiryMode = "set_date" | "lifetime" | "expire_now" | "extend_days";

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toDateInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function ConsultantSubscriptionsPage() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [editing, setEditing] = useState<SubRow | null>(null);
  const [mode, setMode] = useState<ExpiryMode>("set_date");
  const [endsAt, setEndsAt] = useState("");
  const [days, setDays] = useState("30");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formMsg, setFormMsg] = useState("");
  const [formWarning, setFormWarning] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "25" });
      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("status", status);
      const res = await fetch(`${API}/admin/consultant-subscriptions?${params}`, {
        headers: adminAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load subscriptions.");
      setRows(json.data ?? []);
      setStats(json.stats ?? null);
      setLastPage(json.meta?.last_page ?? 1);
      setTotal(json.meta?.total ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEditor(row: SubRow) {
    setEditing(row);
    setMode(row.is_lifetime ? "lifetime" : "set_date");
    setEndsAt(toDateInputValue(row.ends_at) || new Date().toISOString().slice(0, 10));
    setDays("30");
    setNote("");
    setFormError("");
    setFormMsg("");
    setFormWarning("");
  }

  async function saveExpiry() {
    if (!editing) return;
    setSaving(true);
    setFormError("");
    setFormMsg("");
    setFormWarning("");
    try {
      const body: Record<string, unknown> = { mode, note: note.trim() || null };
      if (mode === "set_date") {
        if (!endsAt) throw new Error("Pick an expiry date.");
        body.ends_at = endsAt;
      }
      if (mode === "extend_days") {
        const n = Number(days);
        if (!Number.isFinite(n) || n < 1) throw new Error("Enter days to extend (1+).");
        body.days = n;
      }

      const res = await fetch(`${API}/admin/consultant-subscriptions/${editing.id}/expiry`, {
        method: "PATCH",
        headers: { ...adminAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        const validation =
          json?.errors && typeof json.errors === "object"
            ? Object.values(json.errors as Record<string, string[]>).flat().join(" ")
            : null;
        throw new Error(validation || json.message || "Update failed.");
      }
      setFormMsg(json.message ?? "Updated.");
      if (json.warning) setFormWarning(json.warning);
      if (json.data) {
        setRows((prev) => prev.map((r) => (r.id === editing.id ? json.data : r)));
        setEditing(json.data);
      }
      void load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Consultant Subscriptions</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Change package access expiry for consultants — set a date, extend days, grant lifetime, or expire now.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Total" value={stats.total} />
          <Stat label="Active access" value={stats.active} />
          <Stat label="On trial" value={stats.trial} />
          <Stat label="Lifetime" value={stats.lifetime} />
          <Stat label="Expired" value={stats.expired} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-xs grow">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1);
            setStatus(v);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="payment_declined">Payment declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultant</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Access</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No subscriptions found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.user?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.user?.email}</div>
                    </TableCell>
                    <TableCell>
                      <div>{row.package?.name ?? "—"}</div>
                      <div className="text-xs capitalize text-muted-foreground">
                        {row.billing_cycle ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize font-normal">
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.is_lifetime ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <Infinity className="h-3.5 w-3.5" /> Lifetime
                        </span>
                      ) : row.status === "trial" ? (
                        <span>Trial · {fmtDate(row.trial_ends_at)}</span>
                      ) : (
                        fmtDate(row.ends_at)
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-normal",
                          row.access_active
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-zinc-200 bg-zinc-50 text-zinc-600",
                        )}
                      >
                        {row.access_active ? "Active" : "No access"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openEditor(row)}>
                        <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                        Change expiry
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} subscription{total === 1 ? "" : "s"} · page {page} of {lastPage}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= lastPage || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change subscription expiry</DialogTitle>
            <DialogDescription>
              {editing?.user?.name} · {editing?.package?.name ?? "No package"} · current:{" "}
              {editing?.is_lifetime ? "Lifetime" : fmtDate(editing?.ends_at)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as ExpiryMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set_date">Set expiry date</SelectItem>
                  <SelectItem value="extend_days">Extend by days</SelectItem>
                  <SelectItem value="lifetime">Lifetime (no expiry)</SelectItem>
                  <SelectItem value="expire_now">Expire now</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "set_date" && (
              <div className="space-y-2">
                <Label htmlFor="ends-at">Expiry date</Label>
                <Input
                  id="ends-at"
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Future date = extend access. Past date = expire access.
                </p>
              </div>
            )}

            {mode === "extend_days" && (
              <div className="space-y-2">
                <Label htmlFor="days">Days to add</Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
            )}

            {mode === "lifetime" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                <Infinity className="mr-1 inline h-4 w-4" />
                Access will stay active with no end date.
              </div>
            )}

            {mode === "expire_now" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <TimerOff className="mr-1 inline h-4 w-4" />
                Access ends immediately (status → expired).
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="note">Admin note (optional)</Label>
              <Textarea
                id="note"
                rows={2}
                placeholder="Reason for this change…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {formError}
              </div>
            )}
            {formMsg && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {formMsg}
              </div>
            )}
            {formWarning && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {formWarning}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Close
            </Button>
            <Button onClick={() => void saveExpiry()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Award,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Search,
  Send,
  UserCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function authHeaders(): Record<string, string> {
  const token =
    (typeof localStorage !== "undefined" ? localStorage.getItem("wtc_token") : null)
    ?? (typeof document !== "undefined"
      ? document.cookie.match(/(?:^|;\s*)wtc_token=([^;]+)/)?.[1]
      : null)
    ?? "";
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type AvailableConsultant = {
  id: number;
  name: string;
  rcic_number?: string | null;
  avatar?: string | null;
  company_name?: string | null;
  company_logo?: string | null;
  company_bio?: string | null;
  company_city?: string | null;
  company_province?: string | null;
  company_website?: string | null;
};

export type PendingConsultantRequest = {
  id: number;
  status: string;
  message?: string | null;
  created_at?: string;
  consultant: AvailableConsultant | null;
};

function ConsultantAvatar({ consultant, size = "lg" }: { consultant: AvailableConsultant; size?: "sm" | "lg" }) {
  const initials = consultant.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const dim = size === "lg" ? "h-14 w-14 text-lg" : "h-10 w-10 text-sm";
  const src = consultant.company_logo || consultant.avatar;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={consultant.name} className={cn(dim, "rounded-full object-cover border-2 border-primary/15 shrink-0")} />
    );
  }

  return (
    <div className={cn(dim, "rounded-full bg-primary/10 flex items-center justify-center shrink-0 border-2 border-primary/15 font-bold text-primary")}>
      {initials}
    </div>
  );
}

function PendingRequestCard({
  request,
  onCancel,
  cancelling,
}: {
  request: PendingConsultantRequest;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const consultant = request.consultant;
  if (!consultant) return null;

  return (
    <Card className="border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          <ConsultantAvatar consultant={consultant} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900">
                <Clock className="h-3 w-3 mr-1" />
                Awaiting acceptance
              </Badge>
            </div>
            <h3 className="font-semibold text-lg mt-2">{consultant.name}</h3>
            {consultant.rcic_number && (
              <p className="text-sm text-primary font-medium flex items-center gap-1.5 mt-0.5">
                <Award className="h-3.5 w-3.5" />
                RCIC {consultant.rcic_number}
              </p>
            )}
            {(consultant.company_city || consultant.company_province) && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <MapPin className="h-3.5 w-3.5" />
                {[consultant.company_city, consultant.company_province].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your request was sent to <strong>{consultant.name}</strong>. They will review it and accept you as a client.
          Once accepted, your immigration workspace will open here.
        </p>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={cancelling}>
          {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
          Cancel request
        </Button>
      </CardContent>
    </Card>
  );
}

function ConsultantCard({
  consultant,
  selected,
  onSelect,
}: {
  consultant: AvailableConsultant;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left rounded-xl border p-5 transition-all hover:shadow-md hover:border-primary/30 w-full",
        selected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "bg-card",
      )}
    >
      <div className="flex items-start gap-4">
        <ConsultantAvatar consultant={consultant} size="sm" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{consultant.name}</h3>
          {consultant.company_name && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
              <Building2 className="h-3 w-3 shrink-0" />
              {consultant.company_name}
            </p>
          )}
          {consultant.rcic_number && (
            <p className="text-xs text-primary font-medium flex items-center gap-1 mt-1">
              <Award className="h-3 w-3 shrink-0" />
              RCIC {consultant.rcic_number}
            </p>
          )}
          {(consultant.company_city || consultant.company_province) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {[consultant.company_city, consultant.company_province].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
        {selected && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
      </div>
      {consultant.company_bio && (
        <p className="text-xs text-muted-foreground mt-3 line-clamp-2 leading-relaxed">{consultant.company_bio}</p>
      )}
    </button>
  );
}

export function ConsultantPicker({
  clientName,
  pendingRequest,
  onUpdated,
}: {
  clientName: string;
  pendingRequest: PendingConsultantRequest | null;
  onUpdated: () => void;
}) {
  const [consultants, setConsultants] = useState<AvailableConsultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  const loadConsultants = useCallback(async (q = "") => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ per_page: "12" });
      if (q) params.set("search", q);
      const res = await fetch(`${API}/client/available-consultants?${params}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to load consultants.");
      setConsultants(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load consultants.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pendingRequest) loadConsultants(search);
  }, [loadConsultants, search, pendingRequest]);

  async function handleSubmit() {
    if (!selectedId) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API}/client/consultant-request`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ consultant_id: selectedId, message: message.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? json?.errors?.consultant_id?.[0] ?? "Request failed.");
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!pendingRequest) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch(`${API}/client/consultant-request/${pendingRequest.id}/cancel`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Cancel failed.");
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Cancel failed.");
    } finally {
      setCancelling(false);
    }
  }

  if (pendingRequest) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCheck className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-bold">Welcome, {clientName}!</h2>
          <p className="text-sm text-muted-foreground">Your consultant request is pending.</p>
        </div>
        <PendingRequestCard request={pendingRequest} onCancel={handleCancel} cancelling={cancelling} />
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <UserCheck className="h-7 w-7 text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-bold">Welcome, {clientName}!</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Choose a licensed RCIC consultant from our network to guide your Canadian immigration journey.
        </p>
      </div>

      <div className="flex flex-col gap-2 max-w-md mx-auto sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, city, or RCIC number..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          />
        </div>
        <Button variant="outline" onClick={() => setSearch(searchInput)} className="h-10 w-full sm:w-auto">Search</Button>
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : consultants.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No consultants available right now. Please try again later or contact RCICMASTER support.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {consultants.map((c) => (
            <ConsultantCard
              key={c.id}
              consultant={c}
              selected={selectedId === c.id}
              onSelect={() => setSelectedId(c.id === selectedId ? null : c.id)}
            />
          ))}
        </div>
      )}

      {selectedId && (
        <Card className="max-w-xl mx-auto border-primary/20">
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-medium">Optional message to your consultant</p>
            <Textarea
              placeholder="Briefly describe your immigration goals (optional)..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={1000}
            />
            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send request to consultant
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

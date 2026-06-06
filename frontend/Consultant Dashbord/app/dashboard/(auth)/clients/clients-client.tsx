"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Users,
  Mail,
  Phone,
  Globe,
  MoreHorizontal,
  Send,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

interface ClientUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

interface Client {
  id: number;
  user_id: number;
  consultant_id: number;
  phone: string | null;
  passport_number: string | null;
  immigration_pathway: string | null;
  family_id: number | null;
  notes: string | null;
  invited_at: string | null;
  created_at: string;
  user: ClientUser;
}

interface Pagination {
  data: Client[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

type Layout = "grid" | "list";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatDate(iso: string | null) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

const PATHWAY_COLORS: Record<string, string> = {
  "Express Entry":        "bg-blue-100 text-blue-700 border-blue-200",
  "PNP":                  "bg-purple-100 text-purple-700 border-purple-200",
  "Family Sponsorship":   "bg-pink-100 text-pink-700 border-pink-200",
  "Study Permit":         "bg-amber-100 text-amber-700 border-amber-200",
  "Work Permit":          "bg-green-100 text-green-700 border-green-200",
  "Refugee":              "bg-red-100 text-red-700 border-red-200",
};

function filterClients(clients: Client[], name: string, email: string, phone: string): Client[] {
  const n = name.trim().toLowerCase();
  const e = email.trim().toLowerCase();
  const p = phone.trim().replace(/\D/g, "");
  return clients.filter(c => {
    if (n && !c.user.name.toLowerCase().includes(n)) return false;
    if (e && !c.user.email.toLowerCase().includes(e)) return false;
    if (p) {
      const clientPhone = (c.user.phone ?? c.phone ?? "").replace(/\D/g, "");
      if (!clientPhone.includes(p)) return false;
    }
    return true;
  });
}

export function ClientsPageClient() {
  const router = useRouter();
  const [pagination,  setPagination]  = useState<Pagination | null>(null);
  const [allClients,  setAllClients]  = useState<Client[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [page,        setPage]        = useState(1);
  const [deleting,    setDeleting]    = useState<Client | null>(null);
  const [resending,   setResending]   = useState<number | null>(null);
  const [toast,       setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [layout,      setLayout]      = useState<Layout>("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [filterName,  setFilterName]  = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterPhone, setFilterPhone] = useState("");

  const hasActiveFilters = filterName || filterEmail || filterPhone;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async (p = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(p), per_page: "200" });
      const res  = await fetch(`${API}/consultant/clients?${params}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to load clients.");
      setPagination(json);
      setAllClients(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(page); }, [page]);

  const clearFilters = () => {
    setFilterName("");
    setFilterEmail("");
    setFilterPhone("");
  };

  const handleDelete = async (client: Client) => {
    try {
      const res = await fetch(`${API}/consultant/clients/${client.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to remove client.");
      showToast("Client removed successfully.");
      setAllClients(prev => prev.filter(c => c.id !== client.id));
      if (pagination) setPagination(prev => prev ? { ...prev, total: prev.total - 1 } : prev);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to remove client.", "error");
    } finally {
      setDeleting(null);
    }
  };

  const handleResendInvite = async (client: Client) => {
    setResending(client.id);
    try {
      const res = await fetch(`${API}/consultant/clients/${client.id}/resend-invite`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to resend invite.");
      showToast("Invitation resent successfully.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to resend invite.", "error");
    } finally {
      setResending(null);
    }
  };

  const clients = filterClients(allClients, filterName, filterEmail, filterPhone);

  const CardItem = ({ client }: { client: Client }) => (
    <div
      className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/dashboard/clients/${client.id}`)}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm uppercase shrink-0">
            {client.user.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold leading-tight">{client.user.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Added {formatDate(client.created_at)}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/clients/${client.id}`}><Eye className="mr-2 h-4 w-4" /> View Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleResendInvite(client)} disabled={resending === client.id}>
              {resending === client.id
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending&hellip;</>
                : <><Send className="mr-2 h-4 w-4" /> Resend Invite</>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleting(client)}>
              <Trash2 className="mr-2 h-4 w-4" /> Remove Client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
        <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{client.user.email}</span></div>
        {(client.user.phone ?? client.phone) && (
          <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" /><span>{client.user.phone ?? client.phone}</span></div>
        )}
        {client.passport_number && (
          <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 shrink-0" /><span className="font-mono text-xs">{client.passport_number}</span></div>
        )}
      </div>
      {client.immigration_pathway && (
        <Badge variant="outline" className={cn("text-xs", PATHWAY_COLORS[client.immigration_pathway] ?? "bg-gray-100 text-gray-700 border-gray-200")}>
          {client.immigration_pathway}
        </Badge>
      )}
    </div>
  );

  const ListItem = ({ client }: { client: Client }) => (
    <div
      className="flex items-center gap-4 rounded-xl border bg-card px-5 py-3.5 hover:shadow-sm transition-shadow cursor-pointer"
      onClick={() => router.push(`/dashboard/clients/${client.id}`)}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm uppercase shrink-0">
        {client.user.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0 grid sm:grid-cols-3 gap-1 sm:gap-4">
        <div className="min-w-0">
          <p className="font-semibold truncate leading-tight">{client.user.name}</p>
          <p className="text-xs text-muted-foreground">Added {formatDate(client.created_at)}</p>
        </div>
        <div className="min-w-0 flex flex-col gap-0.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5 truncate"><Mail className="h-3.5 w-3.5 shrink-0" />{client.user.email}</span>
          {(client.user.phone ?? client.phone) && (
            <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" />{client.user.phone ?? client.phone}</span>
          )}
        </div>
        <div className="hidden sm:flex items-center">
          {client.immigration_pathway && (
            <Badge variant="outline" className={cn("text-xs", PATHWAY_COLORS[client.immigration_pathway] ?? "bg-gray-100 text-gray-700 border-gray-200")}>
              {client.immigration_pathway}
            </Badge>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/clients/${client.id}`}><Eye className="mr-2 h-4 w-4" /> View Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleResendInvite(client)} disabled={resending === client.id}>
            {resending === client.id
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending&hellip;</>
              : <><Send className="mr-2 h-4 w-4" /> Resend Invite</>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleting(client)}>
            <Trash2 className="mr-2 h-4 w-4" /> Remove Client
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium",
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Clients</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {loading ? "Loading\u2026" : `${clients.length} of ${allClients.length} client${allClients.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/clients/new">
            <UserPlus className="mr-2 h-4 w-4" />
            Add New Client
          </Link>
        </Button>
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name"
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
            />
          </div>

          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-primary text-[10px] font-bold">!</span>
            )}
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}>
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}

          <div className="flex items-center rounded-md border overflow-hidden ml-auto">
            <button
              className={cn("p-1.5 transition-colors", layout === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              onClick={() => setLayout("grid")}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              className={cn("p-1.5 transition-colors", layout === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              onClick={() => setLayout("list")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <Button variant="ghost" size="icon" onClick={() => load(page)} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        {showFilters && (
          <div className="grid sm:grid-cols-2 gap-3 rounded-xl border bg-muted/40 p-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Filter by email"
                value={filterEmail}
                onChange={e => setFilterEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Filter by phone number"
                value={filterPhone}
                onChange={e => setFilterPhone(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => load(page)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading clients&hellip;
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && clients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">No clients found</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-xs">
            {hasActiveFilters
              ? "No clients match your filters. Try adjusting or clearing them."
              : "Get started by adding your first client. They\u2019ll receive an invitation email."}
          </p>
          {hasActiveFilters ? (
            <Button variant="outline" onClick={clearFilters}><X className="mr-2 h-4 w-4" />Clear Filters</Button>
          ) : (
            <Button asChild>
              <Link href="/dashboard/clients/new"><UserPlus className="mr-2 h-4 w-4" />Add New Client</Link>
            </Button>
          )}
        </div>
      )}

      {/* Client list */}
      {!loading && clients.length > 0 && (
        <>
          {layout === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {clients.map(client => <CardItem key={client.id} client={client} />)}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {clients.map(client => <ListItem key={client.id} client={client} />)}
            </div>
          )}

          {pagination && pagination.last_page > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.current_page} of {pagination.last_page}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pagination.last_page} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleting?.user.name}</strong>&apos;s profile and portal account.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleting && handleDelete(deleting)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

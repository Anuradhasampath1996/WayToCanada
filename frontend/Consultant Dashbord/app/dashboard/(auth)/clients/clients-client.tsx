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
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
const FETCH_TIMEOUT_MS = 20_000;

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
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatDate(iso: string | null) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function clientPhone(client: Client): string | null {
  return client.user.phone ?? client.phone;
}

function toWhatsAppUrl(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = `1${digits}`;
  return `https://wa.me/${digits}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

const PATHWAY_COLORS: Record<string, string> = {
  "Express Entry": "bg-blue-500/10 text-blue-700 border-blue-200/60",
  PNP: "bg-violet-500/10 text-violet-700 border-violet-200/60",
  "Family Sponsorship": "bg-pink-500/10 text-pink-700 border-pink-200/60",
  "Study Permit": "bg-amber-500/10 text-amber-700 border-amber-200/60",
  "Work Permit": "bg-emerald-500/10 text-emerald-700 border-emerald-200/60",
  Refugee: "bg-red-500/10 text-red-700 border-red-200/60",
};

function filterClients(clients: Client[], name: string, email: string, phone: string): Client[] {
  const n = name.trim().toLowerCase();
  const e = email.trim().toLowerCase();
  const p = phone.trim().replace(/\D/g, "");
  return clients.filter((c) => {
    if (n && !c.user.name.toLowerCase().includes(n)) return false;
    if (e && !c.user.email.toLowerCase().includes(e)) return false;
    if (p) {
      const clientPhoneDigits = (clientPhone(c) ?? "").replace(/\D/g, "");
      if (!clientPhoneDigits.includes(p)) return false;
    }
    return true;
  });
}

function EmailLink({ email }: { email: string }) {
  return (
    <a
      href={`mailto:${email}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex max-w-full items-center gap-1.5 truncate text-sm text-primary underline-offset-4 hover:underline"
      title={`Email ${email}`}
    >
      <Mail className="size-3.5 shrink-0 opacity-70" />
      <span className="truncate">{email}</span>
    </a>
  );
}

function PhoneLink({ phone }: { phone: string }) {
  return (
    <a
      href={toWhatsAppUrl(phone)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 text-sm text-emerald-700 underline-offset-4 hover:text-emerald-800 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
      title={`Open WhatsApp chat with ${phone}`}
    >
      <MessageCircle className="size-3.5 shrink-0" />
      <span>{phone}</span>
    </a>
  );
}

function ClientActions({
  client,
  resending,
  onResend,
  onDelete,
}: {
  client: Client;
  resending: number | null;
  onResend: (client: Client) => void;
  onDelete: (client: Client) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="size-8 shrink-0">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/clients/${client.id}`}>
            <Eye className="mr-2 size-4" />
            View profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onResend(client)} disabled={resending === client.id}>
          {resending === client.id ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="mr-2 size-4" />
              Resend invite
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => onDelete(client)}>
          <Trash2 className="mr-2 size-4" />
          Remove client
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ClientsPageClient() {
  const router = useRouter();
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [resending, setResending] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [layout, setLayout] = useState<Layout>("list");
  const [showFilters, setShowFilters] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterPhone, setFilterPhone] = useState("");

  const hasActiveFilters = filterName || filterEmail || filterPhone;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
      if (!token) {
        throw new Error("You are not signed in. Please log in again.");
      }

      const params = new URLSearchParams({ page: String(p), per_page: "50" });
      const res = await fetch(`${API}/consultant/clients?${params}`, {
        headers: authHeaders(),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { message?: string })?.message ?? `Failed to load clients (${res.status}).`);
      }
      setPagination(json as Pagination);
      setAllClients((json as Pagination).data ?? []);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError(
          "The server is not responding. Make sure the API is running (php artisan serve on port 8000), then click Retry.",
        );
      } else {
        setError(e instanceof Error ? e.message : "Failed to load clients.");
      }
      setPagination(null);
      setAllClients([]);
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

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
      setAllClients((prev) => prev.filter((c) => c.id !== client.id));
      if (pagination) setPagination((prev) => (prev ? { ...prev, total: prev.total - 1 } : prev));
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
  const openClient = (id: number) => router.push(`/dashboard/clients/${id}`);

  const CardItem = ({ client }: { client: Client }) => {
    const phone = clientPhone(client);
    return (
      <div
        className="cursor-pointer rounded-xl border border-border/70 bg-card p-5 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
        onClick={() => openClient(client.id)}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
              {initials(client.user.name) || client.user.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold leading-tight">{client.user.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Added {formatDate(client.created_at)}</p>
            </div>
          </div>
          <ClientActions
            client={client}
            resending={resending}
            onResend={handleResendInvite}
            onDelete={setDeleting}
          />
        </div>
        <div className="space-y-2">
          <EmailLink email={client.user.email} />
          {phone && <PhoneLink phone={phone} />}
          {client.passport_number && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="size-3.5 shrink-0" />
              <span className="font-mono">{client.passport_number}</span>
            </div>
          )}
        </div>
        {client.immigration_pathway && (
          <Badge
            variant="outline"
            className={cn(
              "mt-4 text-xs",
              PATHWAY_COLORS[client.immigration_pathway] ?? "bg-muted text-muted-foreground",
            )}
          >
            {client.immigration_pathway}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      {toast && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-sm",
            toast.type === "success"
              ? "border-emerald-200/80 bg-background text-emerald-800"
              : "border-red-200/80 bg-background text-red-700",
          )}
        >
          {toast.msg}
        </div>
      )}

      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="size-5" />
              </span>
              My clients
            </h1>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading…"
                : `${clients.length} of ${allClients.length} client${allClients.length !== 1 ? "s" : ""} in your practice`}
            </p>
          </div>
          <Button asChild className="shrink-0 rounded-xl">
            <Link href="/dashboard/clients/new">
              <UserPlus className="mr-2 size-4" />
              Add new client
            </Link>
          </Button>
        </div>
      </section>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 rounded-xl bg-muted/20 pl-9"
                placeholder="Search by name…"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
              />
            </div>

            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              className="gap-1.5 rounded-xl"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="size-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-background text-[10px] font-bold text-primary">
                  !
                </span>
              )}
            </Button>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}>
                <X className="size-4" />
                Clear
              </Button>
            )}

            <div className="ml-auto flex items-center overflow-hidden rounded-xl border">
              <button
                type="button"
                className={cn(
                  "p-2 transition-colors",
                  layout === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
                onClick={() => setLayout("list")}
                title="List view"
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                className={cn(
                  "p-2 transition-colors",
                  layout === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
                onClick={() => setLayout("grid")}
                title="Grid view"
              >
                <LayoutGrid className="size-4" />
              </button>
            </div>

            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => void load(page)} disabled={loading}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </div>

          {showFilters && (
            <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/15 p-4 sm:grid-cols-2">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 rounded-xl bg-background pl-9"
                  placeholder="Filter by email"
                  value={filterEmail}
                  onChange={(e) => setFilterEmail(e.target.value)}
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 rounded-xl bg-background pl-9"
                  placeholder="Filter by phone number"
                  value={filterPhone}
                  onChange={(e) => setFilterPhone(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => void load(page)}>
            <RefreshCw className="mr-1.5 size-4" />
            Retry
          </Button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Loading clients…
        </div>
      )}

      {!loading && !error && clients.length === 0 && (
        <Card className="border-dashed border-border/70 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="mb-4 size-12 text-muted-foreground/40" />
            <h3 className="mb-1 text-lg font-semibold">No clients found</h3>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              {hasActiveFilters
                ? "No clients match your filters. Try adjusting or clearing them."
                : "Get started by adding your first client. They'll receive an invitation email."}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters} className="rounded-xl">
                <X className="mr-2 size-4" />
                Clear filters
              </Button>
            ) : (
              <Button asChild className="rounded-xl">
                <Link href="/dashboard/clients/new">
                  <UserPlus className="mr-2 size-4" />
                  Add new client
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && clients.length > 0 && (
        <>
          {layout === "list" ? (
            <Card className="overflow-hidden border-border/70 shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[200px]">Client</TableHead>
                      <TableHead className="min-w-[220px]">Email</TableHead>
                      <TableHead className="min-w-[160px]">Phone / WhatsApp</TableHead>
                      <TableHead>Pathway</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => {
                      const phone = clientPhone(client);
                      return (
                        <TableRow
                          key={client.id}
                          className="cursor-pointer"
                          onClick={() => openClient(client.id)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                {initials(client.user.name) || client.user.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold leading-tight">{client.user.name}</p>
                                {client.passport_number && (
                                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                                    {client.passport_number}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <EmailLink email={client.user.email} />
                          </TableCell>
                          <TableCell>
                            {phone ? (
                              <PhoneLink phone={phone} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {client.immigration_pathway ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  PATHWAY_COLORS[client.immigration_pathway] ?? "bg-muted text-muted-foreground",
                                )}
                              >
                                {client.immigration_pathway}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatDate(client.created_at)}
                          </TableCell>
                          <TableCell>
                            <ClientActions
                              client={client}
                              resending={resending}
                              onResend={handleResendInvite}
                              onDelete={setDeleting}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {clients.map((client) => (
                <CardItem key={client.id} client={client} />
              ))}
            </div>
          )}

          {pagination && pagination.last_page > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" className="rounded-xl" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.current_page} of {pagination.last_page}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={page >= pagination.last_page}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

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

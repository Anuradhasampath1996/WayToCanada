"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileDown,
  FileText,
  Filter,
  Loader2,
  Scale,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export type LegislationDoc = {
  id: number;
  title: string;
  source_slug: string;
  act_code: string | null;
  language: string;
  format: string;
  category?: string | null;
  provisions_count: number;
  last_synced_at: string | null;
  has_viewer: boolean;
  ai_analyzed?: boolean;
  source_url?: string | null;
};

export type LegislationDocGroup = {
  key: string;
  title: string;
  act_code: string | null;
  source_slug: string;
  language: string;
  category?: string | null;
  provisions_count: number;
  last_synced_at: string | null;
  formats: Partial<Record<"xml" | "html" | "pdf", LegislationDoc>>;
  hasSmartPopups: boolean;
};

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("wtc_consultant_token") ??
        document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1] ??
        ""
      : "";
  return { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function groupDocuments(docs: LegislationDoc[]): LegislationDocGroup[] {
  const map = new Map<string, LegislationDocGroup>();

  for (const doc of docs) {
    const key = `${doc.act_code ?? doc.source_slug}::${doc.language}`;
    const existing = map.get(key);
    const fmt = doc.format as "xml" | "html" | "pdf";

    if (!existing) {
      map.set(key, {
        key,
        title: doc.title.replace(/\s*\(XML\)|\s*\(HTML\)|\s*\(PDF\)/gi, "").trim(),
        act_code: doc.act_code,
        source_slug: doc.source_slug,
        language: doc.language,
        category: doc.category,
        provisions_count: doc.provisions_count,
        last_synced_at: doc.last_synced_at,
        formats: { [fmt]: doc },
        hasSmartPopups: doc.format === "xml" && doc.has_viewer,
      });
      continue;
    }

    existing.formats[fmt] = doc;
    existing.provisions_count = Math.max(existing.provisions_count, doc.provisions_count);
    if (doc.format === "xml" && doc.has_viewer) existing.hasSmartPopups = true;
    if (doc.last_synced_at && (!existing.last_synced_at || doc.last_synced_at > existing.last_synced_at)) {
      existing.last_synced_at = doc.last_synced_at;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
}

function formatLabels(group: LegislationDocGroup): string[] {
  return (["xml", "html", "pdf"] as const).filter((f) => group.formats[f]);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

const FORMAT_META = {
  xml: {
    label: "XML — Interactive",
    description: "Smart popups on legal references. Click any link to preview the cited section.",
    icon: Sparkles,
    recommended: true,
  },
  html: {
    label: "HTML — Web view",
    description: "Formatted web page. No interactive reference popups.",
    icon: FileText,
    recommended: false,
  },
  pdf: {
    label: "PDF — Official file",
    description: "Download or open the official consolidated PDF.",
    icon: FileDown,
    recommended: false,
  },
} as const;

export function LegislationsHubClient() {
  const router = useRouter();
  const [docs, setDocs] = React.useState<LegislationDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [search, setSearch] = React.useState("");
  const [language, setLanguage] = React.useState("all");
  const [format, setFormat] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [actCode, setActCode] = React.useState("all");

  const [pickerGroup, setPickerGroup] = React.useState<LegislationDocGroup | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (language !== "all") params.set("language", language);
      if (format !== "all") params.set("format", format);
      if (category !== "all") params.set("category", category);
      if (actCode !== "all") params.set("act_code", actCode);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`${API}/legislation/documents?${params}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load documents.");
      setDocs(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, [language, format, category, actCode, search]);

  React.useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const actCodes = React.useMemo(() => {
    const codes = new Set<string>();
    docs.forEach((d) => {
      if (d.act_code) codes.add(d.act_code);
    });
    return Array.from(codes).sort();
  }, [docs]);

  const groups = React.useMemo(() => groupDocuments(docs), [docs]);

  const hasFilters = language !== "all" || format !== "all" || category !== "all" || actCode !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setSearch("");
    setLanguage("all");
    setFormat("all");
    setCategory("all");
    setActCode("all");
  };

  const openFormat = async (doc: LegislationDoc) => {
    setPickerGroup(null);
    if (doc.format === "pdf") {
      try {
        const res = await fetch(`${API}/legislation/documents/${doc.id}/download`, { headers: authHeaders() });
        if (!res.ok) throw new Error("PDF not available");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch {
        if (doc.source_url) window.open(doc.source_url, "_blank", "noopener,noreferrer");
      }
      return;
    }
    router.push(`/dashboard/legislations/${doc.id}`);
  };

  const handleOpenGroup = (group: LegislationDocGroup) => {
    const available = formatLabels(group);
    if (available.length === 1) {
      const only = group.formats[available[0] as keyof typeof group.formats];
      if (only) void openFormat(only);
      return;
    }
    setPickerGroup(group);
  };

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background to-primary/5 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Scale className="size-7 text-primary" />
              Legislations Hub
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Canadian Acts &amp; Regulations — browse consolidated legislation in XML, HTML, or PDF.
            </p>
          </div>
        </div>
      </section>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4" />
            Filters
          </CardTitle>
          <CardDescription>Search and narrow by language, format, category, or act code</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, act code, or source…"
              className="pl-9"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All languages</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger><SelectValue placeholder="Format" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All formats</SelectItem>
                <SelectItem value="xml">XML (interactive)</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="act">Acts</SelectItem>
                <SelectItem value="regulation">Regulations</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actCode} onValueChange={setActCode}>
              <SelectTrigger><SelectValue placeholder="Act code" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All act codes</SelectItem>
                {actCodes.map((code) => (
                  <SelectItem key={code} value={code}>{code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
              <X className="mr-1 size-3.5" />
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading legislation documents…
        </div>
      )}

      {!loading && error && (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && groups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No documents match your filters.
          </CardContent>
        </Card>
      )}

      {!loading && !error && groups.length > 0 && (
        <Card className="border-border/70 shadow-sm overflow-hidden">
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Documents</CardTitle>
              <span className="text-xs text-muted-foreground tabular-nums">
                {groups.length} {groups.length === 1 ? "entry" : "entries"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[220px]">Document</TableHead>
                    <TableHead>Act</TableHead>
                    <TableHead>Lang</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Provisions</TableHead>
                    <TableHead>Last update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                      <TableRow
                        key={group.key}
                        className="cursor-pointer"
                        onClick={() => handleOpenGroup(group)}
                      >
                        <TableCell>
                          <p className="font-medium leading-snug line-clamp-2">{group.title}</p>
                        </TableCell>
                        <TableCell>
                          {group.act_code ? (
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {group.act_code}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">{group.source_slug}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase text-[10px]">
                            {group.language}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {group.category ? (
                            <span className="capitalize text-xs">{group.category}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {group.provisions_count.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(group.last_synced_at)}
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!pickerGroup} onOpenChange={(open) => !open && setPickerGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose document format</DialogTitle>
            <DialogDescription>
              {pickerGroup?.title} — select which version to open.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {pickerGroup &&
              (["xml", "html", "pdf"] as const)
                .filter((f) => pickerGroup.formats[f])
                .map((f) => {
                  const doc = pickerGroup.formats[f]!;
                  const meta = FORMAT_META[f];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => void openFormat(doc)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50",
                        meta.recommended && "border-primary/30 bg-primary/5",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-lg",
                          meta.recommended ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{meta.label}</span>
                          {meta.recommended && (
                            <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{meta.description}</span>
                      </span>
                    </button>
                  );
                })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

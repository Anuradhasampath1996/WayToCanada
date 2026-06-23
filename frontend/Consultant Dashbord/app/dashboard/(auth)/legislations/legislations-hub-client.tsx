"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileDown,
  FileText,
  Filter,
  Loader2,
  Scale,
  Search,
  Sparkles,
  Star,
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
import { LegislationLinkChips, type LegislationLink } from "@/components/legislation/legislation-link-chips";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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

export type LegislationSearchResult = {
  provision_id: number;
  act_code: string;
  provision_key: string;
  citation: string;
  section_label: string | null;
  marginal_note: string | null;
  excerpt: string;
  score: number;
  language: string;
  document_title: string | null;
  viewer_document_id: number | null;
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
  isFeatured?: boolean;
};

type HubApiGroup = {
  key: string;
  title: string;
  act_code: string | null;
  source_slug: string;
  language: string;
  category?: string | null;
  provisions_count: number;
  last_synced_at: string | null;
  formats: Partial<Record<string, LegislationDoc>>;
  has_smart_popups: boolean;
  is_featured?: boolean;
};

type HubMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  total_groups: number;
};

type PathwayFacet = {
  slug: string;
  label: string;
  description: string;
  synced_act_count?: number;
};

type ActivePathway = {
  slug: string;
  label: string;
  description: string;
};

const PRIORITY_SHORT: Record<string, string> = {
  "I-2.5": "IRPA",
  "SOR-2002-227": "IRPR",
  "DORS-2002-227": "IRPR",
};

function apiGroupToDocGroup(g: HubApiGroup): LegislationDocGroup {
  return {
    key: g.key,
    title: g.title,
    act_code: g.act_code,
    source_slug: g.source_slug,
    language: g.language,
    category: g.category,
    provisions_count: g.provisions_count,
    last_synced_at: g.last_synced_at,
    formats: g.formats as LegislationDocGroup["formats"],
    hasSmartPopups: g.has_smart_popups,
    isFeatured: g.is_featured,
  };
}

function formatLabels(group: LegislationDocGroup): string[] {
  return (["xml", "html", "pdf"] as const).filter((f) => group.formats[f]);
}

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("wtc_consultant_token") ??
        document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1] ??
        ""
      : "";
  return { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function DocumentGroupCards({
  groups,
  onOpen,
  featured = false,
}: {
  groups: LegislationDocGroup[];
  onOpen: (group: LegislationDocGroup) => void;
  featured?: boolean;
}) {
  return (
    <ul className="divide-y divide-border/60 md:hidden">
      {groups.map((group) => (
        <li key={group.key}>
          <button
            type="button"
            onClick={() => onOpen(group)}
            className={cn(
              "w-full px-3 py-3 text-left transition-colors active:bg-muted/50 sm:px-4",
              featured && "bg-primary/5",
            )}
          >
            <div className="flex items-start gap-2">
              {featured && <Star className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug break-words">{group.title}</p>
                {group.act_code && PRIORITY_SHORT[group.act_code] && (
                  <p className="mt-0.5 text-[10px] font-medium text-primary">
                    {PRIORITY_SHORT[group.act_code]}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {group.act_code ? (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {group.act_code}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">{group.source_slug}</span>
                  )}
                  <Badge variant="outline" className="uppercase text-[10px]">
                    {group.language}
                  </Badge>
                  {group.category && (
                    <span className="text-[10px] capitalize text-muted-foreground">{group.category}</span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span>{group.provisions_count.toLocaleString()} provisions</span>
                  <span className="shrink-0">{fmtDate(group.last_synced_at)}</span>
                </div>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DocumentGroupRows({
  groups,
  onOpen,
  featured = false,
}: {
  groups: LegislationDocGroup[];
  onOpen: (group: LegislationDocGroup) => void;
  featured?: boolean;
}) {
  return (
    <>
      {groups.map((group) => (
        <TableRow
          key={group.key}
          className={cn("cursor-pointer", featured && "bg-primary/5 hover:bg-primary/10")}
          onClick={() => onOpen(group)}
        >
          <TableCell>
            <div className="flex items-start gap-2">
              {featured && <Star className="size-3.5 shrink-0 text-primary mt-1" aria-hidden />}
              <div className="min-w-0">
                <p className="font-medium leading-snug line-clamp-2">{group.title}</p>
                {group.act_code && PRIORITY_SHORT[group.act_code] && (
                  <p className="text-[10px] text-primary font-medium mt-0.5">
                    {PRIORITY_SHORT[group.act_code]}
                  </p>
                )}
              </div>
            </div>
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
    </>
  );
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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [featuredGroups, setFeaturedGroups] = React.useState<LegislationDocGroup[]>([]);
  const [pageGroups, setPageGroups] = React.useState<LegislationDocGroup[]>([]);
  const [hubMeta, setHubMeta] = React.useState<HubMeta>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
    total_groups: 0,
  });
  const [actCodes, setActCodes] = React.useState<string[]>([]);
  const [pathways, setPathways] = React.useState<PathwayFacet[]>([]);
  const [activePathway, setActivePathway] = React.useState<ActivePathway | null>(null);
  const [page, setPage] = React.useState(1);
  const perPage = 20;

  const [search, setSearch] = React.useState("");
  const [language, setLanguage] = React.useState("all");
  const [format, setFormat] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [actCode, setActCode] = React.useState("all");
  const [pathway, setPathway] = React.useState("all");

  const [pickerGroup, setPickerGroup] = React.useState<LegislationDocGroup | null>(null);

  const [smartQuery, setSmartQuery] = React.useState("");
  const [smartLoading, setSmartLoading] = React.useState(false);
  const [smartError, setSmartError] = React.useState("");
  const [smartResults, setSmartResults] = React.useState<LegislationSearchResult[]>([]);
  const [smartMeta, setSmartMeta] = React.useState<{ ai_used?: boolean; openai_available?: boolean } | null>(null);
  const [openAiAvailable, setOpenAiAvailable] = React.useState(false);
  const [bookmarks, setBookmarks] = React.useState<LegislationLink[]>([]);

  React.useEffect(() => {
    async function loadCapabilities() {
      try {
        const res = await fetch(`${API}/legislation/capabilities`, { headers: authHeaders() });
        if (!res.ok) return;
        const json = await res.json();
        setOpenAiAvailable(Boolean(json.data?.openai_available));
      } catch {
        // ignore
      }
    }
    void loadCapabilities();
    async function loadBookmarks() {
      try {
        const res = await fetch(`${API}/consultant/legislation/bookmarks`, { headers: authHeaders() });
        if (!res.ok) return;
        const json = await res.json();
        setBookmarks((json.data ?? []) as LegislationLink[]);
      } catch {
        // ignore
      }
    }
    void loadBookmarks();
  }, []);

  const runSmartSearch = React.useCallback(async () => {
    const q = smartQuery.trim();
    if (q.length < 2) return;

    setSmartLoading(true);
    setSmartError("");
    try {
      const params = new URLSearchParams({
        q,
        language: language === "all" ? "en" : language,
        limit: "12",
        ai: "1",
      });
      const res = await fetch(`${API}/legislation/search?${params}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Search failed.");
      setSmartResults((json.results ?? []) as LegislationSearchResult[]);
      setSmartMeta(json.meta ?? null);
    } catch (e) {
      setSmartError(e instanceof Error ? e.message : "Search failed.");
      setSmartResults([]);
      setSmartMeta(null);
    } finally {
      setSmartLoading(false);
    }
  }, [smartQuery, language]);

  const openSearchResult = (row: LegislationSearchResult) => {
    if (!row.viewer_document_id) return;
    router.push(
      `/dashboard/legislations/${row.viewer_document_id}?provision=${encodeURIComponent(row.provision_key)}`,
    );
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (language !== "all") params.set("language", language);
      if (format !== "all") params.set("format", format);
      if (category !== "all") params.set("category", category);
      if (actCode !== "all") params.set("act_code", actCode);
      if (pathway !== "all") params.set("pathway", pathway);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`${API}/legislation/hub?${params}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load documents.");
      setFeaturedGroups((json.featured ?? []).map((g: HubApiGroup) => apiGroupToDocGroup(g)));
      setPageGroups((json.data ?? []).map((g: HubApiGroup) => apiGroupToDocGroup(g)));
      setHubMeta(json.meta ?? { current_page: 1, last_page: 1, per_page: perPage, total: 0, total_groups: 0 });
      if (json.facets?.act_codes) {
        setActCodes(json.facets.act_codes as string[]);
      }
      if (json.facets?.pathways) {
        setPathways(json.facets.pathways as PathwayFacet[]);
      }
      setActivePathway((json.pathway as ActivePathway | null) ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, [language, format, category, actCode, pathway, search, page, perPage]);

  React.useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const hasFilters =
    language !== "all" ||
    format !== "all" ||
    category !== "all" ||
    actCode !== "all" ||
    pathway !== "all" ||
    search.trim() !== "";
  const showFeatured =
    featuredGroups.length > 0 && !search.trim() && actCode === "all" && pathway === "all";

  const clearFilters = () => {
    setSearch("");
    setLanguage("all");
    setFormat("all");
    setCategory("all");
    setActCode("all");
    setPathway("all");
    setPage(1);
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
    <div className="min-w-0 space-y-4 overflow-x-hidden pb-8 sm:space-y-6">
      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background to-primary/5 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
              <Scale className="size-6 shrink-0 text-primary sm:size-7" />
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
          <CardDescription>Search and narrow by immigration pathway, language, format, category, or act code</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={pathway} onValueChange={(v) => { setPage(1); setPathway(v); }}>
            <SelectTrigger className="w-full border-primary/30 bg-primary/5">
              <SelectValue placeholder="Immigration pathway" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All pathways — full legislation library</SelectItem>
              {pathways.map((p) => (
                <SelectItem key={p.slug} value={p.slug}>
                  {p.label}
                  {p.synced_act_count != null && p.synced_act_count > 0
                    ? ` (${p.synced_act_count} acts/regs synced)`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activePathway && (
            <p className="text-xs text-muted-foreground rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <span className="font-medium text-foreground">{activePathway.label}</span>
              {activePathway.description ? ` — ${activePathway.description}` : ""}
            </p>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search title, act code, or source…"
              className="pl-9"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Select value={language} onValueChange={(v) => { setPage(1); setLanguage(v); }}>
              <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All languages</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
            <Select value={format} onValueChange={(v) => { setPage(1); setFormat(v); }}>
              <SelectTrigger><SelectValue placeholder="Format" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All formats</SelectItem>
                <SelectItem value="xml">XML (interactive)</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={(v) => { setPage(1); setCategory(v); }}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="act">Acts</SelectItem>
                <SelectItem value="regulation">Regulations</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actCode} onValueChange={(v) => { setPage(1); setActCode(v); }}>
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

      <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Sparkles className="size-4 shrink-0 text-primary" />
            Smart provision search
            {openAiAvailable && (
              <Badge variant="secondary" className="text-[10px] font-normal">AI ranking</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Search inside IRPA/IRPR section text — e.g. &quot;study permit conditions&quot;, &quot;misrepresentation&quot;, &quot;criminal inadmissibility&quot;
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={smartQuery}
              onChange={(e) => setSmartQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSmartSearch();
              }}
              placeholder="Ask in plain language or enter keywords…"
              className="flex-1"
            />
            <Button
              type="button"
              onClick={() => void runSmartSearch()}
              disabled={smartLoading || smartQuery.trim().length < 2}
              className="h-10 w-full shrink-0 sm:w-auto"
            >
              {smartLoading ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Search className="mr-1 size-4" />}
              Search provisions
            </Button>
          </div>

          {smartMeta?.ai_used && (
            <p className="text-[11px] text-primary">Results ranked with Maple AI</p>
          )}

          {smartError && <p className="text-sm text-destructive">{smartError}</p>}

          {smartResults.length > 0 && (
            <ul className="space-y-2">
              {smartResults.map((row) => (
                <li
                  key={row.provision_id}
                  className="rounded-xl border border-border/70 bg-background p-3 transition-colors hover:border-primary/30"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold leading-snug break-words">{row.citation}</p>
                        <Badge variant="outline" className="font-mono text-[10px]">{row.act_code}</Badge>
                      </div>
                      {row.marginal_note && (
                        <p className="text-xs italic text-muted-foreground">{row.marginal_note}</p>
                      )}
                      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">{row.excerpt}</p>
                    </div>
                    {row.viewer_document_id && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 w-full shrink-0 sm:w-auto"
                        onClick={() => openSearchResult(row)}
                      >
                        Open section
                        <ArrowRight className="ml-1 size-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!smartLoading && smartQuery.trim().length >= 2 && smartResults.length === 0 && !smartError && smartMeta && (
            <p className="text-sm text-muted-foreground">No matching provisions found. Try different keywords.</p>
          )}
        </CardContent>
      </Card>

      {bookmarks.length > 0 && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Saved sections</CardTitle>
            <CardDescription>Bookmarks from Legislation Hub popups</CardDescription>
          </CardHeader>
          <CardContent>
            <LegislationLinkChips links={bookmarks} />
          </CardContent>
        </Card>
      )}

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

      {!loading && !error && !showFeatured && pageGroups.length === 0 && featuredGroups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {pathway !== "all" && activePathway
              ? `No synced documents for “${activePathway.label}” yet. Ask your admin to sync the related acts and regulations.`
              : "No documents match your filters."}
          </CardContent>
        </Card>
      )}

      {!loading && !error && showFeatured && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background shadow-sm overflow-hidden">
          <CardHeader className="border-b border-primary/20 pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Star className="size-4 shrink-0 fill-primary/20 text-primary" />
                Frequently used — Immigration essentials
              </CardTitle>
              <span className="text-xs text-muted-foreground tabular-nums">
                {featuredGroups.length} {featuredGroups.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            <CardDescription>
              IRPA, IRPR, and other acts consultants open most often — always shown at the top.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DocumentGroupCards groups={featuredGroups} onOpen={handleOpenGroup} featured />
            <div className="hidden overflow-x-auto md:block">
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
                  <DocumentGroupRows groups={featuredGroups} onOpen={handleOpenGroup} featured />
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (pageGroups.length > 0 || (showFeatured && hubMeta.total > 0)) && (
        <Card className="border-border/70 shadow-sm overflow-hidden">
          <CardHeader className="border-b pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">
                {showFeatured ? "All other legislation" : pathway !== "all" ? activePathway?.label ?? "Pathway documents" : "Documents"}
              </CardTitle>
              <span className="text-xs text-muted-foreground tabular-nums">
                {hubMeta.total.toLocaleString()} {hubMeta.total === 1 ? "entry" : "entries"}
                {hubMeta.total_groups > 0 && showFeatured && (
                  <> · {hubMeta.total_groups.toLocaleString()} total in library</>
                )}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            {pageGroups.length > 0 ? (
              <>
                <DocumentGroupCards groups={pageGroups} onOpen={handleOpenGroup} />
                <div className="hidden overflow-x-auto md:block">
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
                    <DocumentGroupRows groups={pageGroups} onOpen={handleOpenGroup} />
                  </TableBody>
                </Table>
                </div>
              </>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No other documents on this page — browse featured acts above.
              </p>
            )}

            {hubMeta.last_page > 1 && (
              <div className="px-3 pb-4 sm:px-4">
                <Pagination className="max-w-full overflow-x-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page > 1) setPage(page - 1);
                        }}
                        className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(5, hubMeta.last_page) }, (_, i) => {
                      const start = Math.max(1, Math.min(page - 2, hubMeta.last_page - 4));
                      const p = start + i;
                      if (p > hubMeta.last_page) return null;
                      return (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === page}
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(p);
                            }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page < hubMeta.last_page) setPage(page + 1);
                        }}
                        className={page >= hubMeta.last_page ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <p className="text-center text-[11px] text-muted-foreground mt-2">
                  Page {hubMeta.current_page} of {hubMeta.last_page}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!pickerGroup} onOpenChange={(open) => !open && setPickerGroup(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] p-4 sm:max-w-md sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug">Choose document format</DialogTitle>
            <DialogDescription className="break-words">
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

"use client";

import * as React from "react";
import { Award, ChevronRight, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export type PathwayCatalogNode = {
  code: string;
  parent_code: string | null;
  label: string;
  family: string;
  hub_family?: string | null;
  province_code?: string | null;
  community_code?: string | null;
  crs_backend_value?: string | null;
  retainer_fee?: number | null;
  is_assignable: boolean;
  is_popular: boolean;
  children?: PathwayCatalogNode[];
};

function AssignableLeafButton({
  node,
  selected,
  onSelect,
}: {
  node: PathwayCatalogNode;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = [node.province_code, node.community_code].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-md border px-2.5 py-2 text-left text-xs",
        selected ? "border-primary bg-primary/5 font-medium" : "border-border/60 hover:border-primary/30",
      )}
    >
      <span className="block">{node.label}</span>
      {meta ? <span className="mt-0.5 block text-[10px] text-muted-foreground">{meta}</span> : null}
      {node.is_popular ? (
        <Badge variant="outline" className="mt-1 h-4 px-1 text-[9px]">
          Popular
        </Badge>
      ) : null}
    </button>
  );
}

/** Group assignable leaves by province when most nodes have a province_code (RCIP/FCIP/AIP). */
function groupByProvince(nodes: PathwayCatalogNode[]): { key: string; nodes: PathwayCatalogNode[] }[] {
  const withProv = nodes.filter((n) => n.province_code);
  if (withProv.length < Math.ceil(nodes.length * 0.6)) {
    return [{ key: "", nodes }];
  }
  const map = new Map<string, PathwayCatalogNode[]>();
  for (const n of nodes) {
    const key = n.province_code || "Other";
    const list = map.get(key) ?? [];
    list.push(n);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, groupNodes]) => ({ key, nodes: groupNodes }));
}

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function ConsultantPathwayCatalogPicker({
  profileId,
  assignedPathway,
  assignedPathwayCode,
  assigning,
  onAssign,
}: {
  profileId: string;
  assignedPathway: string | null;
  assignedPathwayCode?: string | null;
  assigning: string | null;
  onAssign: (payload: {
    pathway_code: string | null;
    immigration_pathway: string;
    crs_backend_value?: string | null;
  }) => void;
}) {
  const [tree, setTree] = React.useState<PathwayCatalogNode[]>([]);
  const [popular, setPopular] = React.useState<PathwayCatalogNode[]>([]);
  const [suggested, setSuggested] = React.useState<PathwayCatalogNode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [browseRoot, setBrowseRoot] = React.useState<string | null>(null);
  const [selectedCode, setSelectedCode] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [catalogRes, suggestRes] = await Promise.all([
          fetch(`${API}/consultant/pathways`, { headers: authHeaders() }),
          fetch(`${API}/consultant/clients/${profileId}/pathways/suggested`, { headers: authHeaders() }),
        ]);
        const catalogJson = await catalogRes.json();
        const suggestJson = await suggestRes.json();
        if (cancelled) return;
        setTree(catalogJson.tree ?? []);
        setPopular(catalogJson.popular ?? []);
        setSuggested(suggestJson.suggested ?? []);
      } catch {
        if (!cancelled) {
          setTree([]);
          setPopular([]);
          setSuggested([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  React.useEffect(() => {
    if (assignedPathwayCode) setSelectedCode(assignedPathwayCode);
  }, [assignedPathwayCode]);

  const flatAssignable = React.useMemo(() => {
    const out: PathwayCatalogNode[] = [];
    const walk = (nodes: PathwayCatalogNode[]) => {
      for (const n of nodes) {
        if (n.is_assignable) out.push(n);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(tree);
    return out;
  }, [tree]);

  const selectedNode =
    flatAssignable.find((n) => n.code === selectedCode) ??
    suggested.find((n) => n.code === selectedCode) ??
    popular.find((n) => n.code === selectedCode) ??
    null;

  const browseNode = browseRoot ? tree.find((n) => n.code === browseRoot) : null;
  const browseChildren = browseNode?.children?.filter((c) => c.is_assignable || (c.children?.length ?? 0) > 0) ?? [];

  const isLoading =
    Boolean(assigning) &&
    (assigning === selectedNode?.label || assigning === selectedNode?.code || assigning === selectedCode);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading pathway catalog…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold">Pathway catalog — popular first</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Suggestions use the questionnaire. Browse EE, PNP streams, Quebec, business immigration, or RCIP/FCIP pilots.
        </p>
      </div>

      {(suggested.length > 0 || popular.length > 0) && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Suggested for this client</p>
          <div className="flex flex-wrap gap-2">
            {(suggested.length > 0 ? suggested : popular).slice(0, 8).map((n) => (
              <button
                key={n.code}
                type="button"
                onClick={() => setSelectedCode(n.code)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                  selectedCode === n.code
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/70 bg-background hover:border-primary/40",
                )}
              >
                {n.is_popular && <Star className="size-3 text-amber-500" />}
                {n.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Browse families</p>
        <div className="flex flex-wrap gap-2">
          {tree.map((root) => (
            <button
              key={root.code}
              type="button"
              onClick={() => {
                setBrowseRoot(root.code);
                if (root.is_assignable) setSelectedCode(root.code);
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs",
                browseRoot === root.code
                  ? "border-violet-300 bg-violet-50 text-violet-900"
                  : "border-border/70 bg-background hover:bg-muted/40",
              )}
            >
              {root.label}
              {(root.children?.length ?? 0) > 0 && <ChevronRight className="size-3 opacity-60" />}
            </button>
          ))}
        </div>

        {browseNode && browseChildren.length > 0 && (
          <div className="rounded-lg border bg-background/80 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{browseNode.label}</p>
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {(() => {
                const leafOnly = browseChildren.filter(
                  (c) => c.is_assignable && !(c.children?.some((g) => g.is_assignable) ?? false),
                );
                const branches = browseChildren.filter(
                  (c) => (c.children?.some((g) => g.is_assignable) ?? false),
                );

                return (
                  <>
                    {leafOnly.length > 0 &&
                      groupByProvince(leafOnly).map(({ key, nodes }) => (
                        <div key={key || "all"} className="space-y-1.5">
                          {key ? (
                            <p className="sticky top-0 z-[1] bg-background/95 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {key}
                            </p>
                          ) : null}
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {nodes.map((child) => (
                              <AssignableLeafButton
                                key={child.code}
                                node={child}
                                selected={selectedCode === child.code}
                                onSelect={() => setSelectedCode(child.code)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}

                    {branches.map((child) => {
                      const kids = (child.children ?? []).filter((g) => g.is_assignable);
                      return (
                        <div key={child.code} className="space-y-1.5 rounded-md border border-border/50 p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="px-1 text-[11px] font-semibold text-muted-foreground">{child.label}</p>
                            {child.is_assignable ? (
                              <button
                                type="button"
                                onClick={() => setSelectedCode(child.code)}
                                className={cn(
                                  "rounded border px-1.5 py-0.5 text-[10px]",
                                  selectedCode === child.code
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border/70 text-muted-foreground hover:border-primary/40",
                                )}
                              >
                                Select this program
                              </button>
                            ) : null}
                          </div>
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {groupByProvince(kids).flatMap(({ nodes }) =>
                              nodes.map((g) => (
                                <AssignableLeafButton
                                  key={g.code}
                                  node={g}
                                  selected={selectedCode === g.code}
                                  onSelect={() => setSelectedCode(g.code)}
                                />
                              )),
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {selectedNode && (
        <div className="rounded-lg border border-emerald-200/70 bg-emerald-500/[0.05] px-3 py-2 text-xs">
          <span className="font-medium text-emerald-900">Selected:</span>{" "}
          <span className="text-emerald-800">{selectedNode.label}</span>
          {selectedNode.retainer_fee ? (
            <span className="text-muted-foreground"> · default fee ${selectedNode.retainer_fee} CAD</span>
          ) : null}
        </div>
      )}

      <Button
        className="w-full gap-2 rounded-xl"
        variant="outline"
        disabled={!selectedNode || isLoading || assignedPathwayCode === selectedNode?.code}
        onClick={() => {
          if (!selectedNode) return;
          onAssign({
            pathway_code: selectedNode.code,
            immigration_pathway: selectedNode.label,
            crs_backend_value: selectedNode.crs_backend_value,
          });
        }}
      >
        {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Award className="size-4" />}
        {assignedPathwayCode === selectedNode?.code
          ? "Already assigned"
          : assignedPathway === selectedNode?.label
            ? "Already assigned"
            : "Assign selected pathway"}
      </Button>
    </div>
  );
}

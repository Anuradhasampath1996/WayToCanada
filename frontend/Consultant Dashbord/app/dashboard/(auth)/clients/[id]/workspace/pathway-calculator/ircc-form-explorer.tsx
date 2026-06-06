"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, FileCheck, FileText, RotateCcw, Send, CheckCircle2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PackageDocument {
  id: number;
  label: string;
  doc_type: string;
  original_filename: string;
  file_url: string;
}

interface ResultPackage {
  guide: string;
  checklist: string;
  forms: string[];
}

interface Level3 {
  id: number;
  label: string;
  result: ResultPackage | null;
  documents?: PackageDocument[];
}
interface Level2 { id: number; label: string; children: Level3[]; }
interface Level1 { id: number; label: string; children: Level2[]; }

// ─── Module-level cache ─────────────────────────────────────────────────────

let treeCache: Level1[] | null = null;
let treeFetchPromise: Promise<Level1[]> | null = null;

function getTree(): Promise<Level1[]> {
  if (treeCache) return Promise.resolve(treeCache);
  if (treeFetchPromise) return treeFetchPromise;
  treeFetchPromise = fetch(`${API}/ircc-forms/tree`)
    .then(r => r.json())
    .then(data => { treeCache = data; return data as Level1[]; });
  return treeFetchPromise;
}

function authHeaders(): Record<string, string> {
  const token =
    document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1] ??
    localStorage.getItem("wtc_consultant_token") ?? "";
  const h: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// ─── Custom styled select ────────────────────────────────────────────────────

function StepSelect({
  step, stepLabel, placeholder, value, options, disabled, onChange,
}: {
  step: number; stepLabel: string; placeholder: string;
  value: number | ""; options: { id: number; label: string }[];
  disabled: boolean; onChange: (v: number | "") => void;
}) {
  const active = !disabled;
  return (
    <div className="space-y-1.5">
      <label className={cn(
        "text-xs font-semibold uppercase tracking-wide flex items-center gap-2",
        active ? "text-foreground" : "text-muted-foreground/50",
      )}>
        <span className={cn(
          "inline-flex h-5 w-5 rounded-full text-[11px] items-center justify-center font-bold shrink-0",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}>
          {step}
        </span>
        {stepLabel}
      </label>

      <div className="relative">
        <select
          disabled={disabled}
          value={value}
          onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={cn(
            "w-full appearance-none rounded-lg border px-3 py-2.5 pr-9 text-sm",
            "bg-background ring-offset-background transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-40",
            active && value !== "" ? "border-primary/60 bg-primary/5" : "border-input",
          )}
        >
          <option value="">{placeholder}</option>
          {options.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className={cn(
          "pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0",
          active ? "text-muted-foreground" : "text-muted-foreground/40",
        )} />
      </div>
    </div>
  );
}

// ─── Result Card ─────────────────────────────────────────────────────────────

function ResultCard({
  result,
  applicationLabel,
  documents,
  assignedCategoryId,
  selectedCategoryId,
  assigning,
  onAssign,
}: {
  result: ResultPackage;
  applicationLabel: string;
  documents: PackageDocument[];
  assignedCategoryId: number | null;
  selectedCategoryId: number;
  assigning: boolean;
  onAssign: () => void;
}) {
  const isAssigned = assignedCategoryId === selectedCategoryId;

  return (
    <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/5 to-blue-50/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-primary/15">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileCheck className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Application Package</p>
            <p className="text-sm font-bold text-foreground leading-tight">{applicationLabel}</p>
          </div>
        </div>
        {isAssigned ? (
          <Badge className="bg-green-600 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Assigned to client
          </Badge>
        ) : (
          <Button size="sm" onClick={onAssign} disabled={assigning} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {assigning ? "Assigning…" : "Assign to Client"}
          </Button>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-white border border-blue-100 p-3">
        <div className="h-8 w-8 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
          <BookOpen className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-widest">Instruction Guide</p>
          <p className="text-sm font-bold text-foreground mt-0.5">{result.guide}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-white border border-green-100 p-3">
        <div className="h-8 w-8 rounded-md bg-green-50 flex items-center justify-center shrink-0">
          <FileCheck className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <p className="text-[10px] text-green-600 font-semibold uppercase tracking-widest">Document Checklist</p>
          <p className="text-sm font-bold text-foreground mt-0.5">{result.checklist}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-white border border-amber-100 p-3">
        <div className="h-8 w-8 rounded-md bg-amber-50 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-widest mb-2">Required Forms</p>
          <div className="flex flex-wrap gap-1.5">
            {result.forms.map((f, i) => (
              <Badge key={i} variant="outline" className="text-xs font-bold border-amber-300 text-amber-800 bg-amber-50/80 px-2 py-0.5">
                {f}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {documents.length > 0 && (
        <div className="rounded-lg bg-white border p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Admin-uploaded Documents
          </p>
          {documents.map(doc => (
            <a
              key={doc.id}
              href={doc.file_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
            >
              <Download className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium">{doc.label}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">{doc.doc_type}</Badge>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function StepConnector({ active }: { active: boolean }) {
  return (
    <div className="flex justify-start pl-[9px]">
      <div className={cn("w-0.5 h-3 rounded-full transition-colors", active ? "bg-primary/40" : "bg-muted")} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IrccFormExplorer({
  clientProfileId,
  assignedCategoryId: initialAssignedId,
  onAssigned,
}: {
  clientProfileId: string;
  assignedCategoryId?: number | null;
  onAssigned?: (categoryId: number) => void;
}) {
  const [tree, setTree] = useState<Level1[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignedCategoryId, setAssignedCategoryId] = useState<number | null>(initialAssignedId ?? null);

  const [sel1, setSel1] = useState<number | "">("");
  const [sel2, setSel2] = useState<number | "">("");
  const [sel3, setSel3] = useState<number | "">("");

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAssignedCategoryId(initialAssignedId ?? null);
  }, [initialAssignedId]);

  useEffect(() => {
    getTree()
      .then(data => { setTree(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => {
    if (sel3 !== "" && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [sel3]);

  async function assignPackage(categoryId: number) {
    setAssigning(true);
    try {
      const res = await fetch(
        `${API}/consultant/clients/${clientProfileId}/case-file/assign-application-package`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ ircc_category_id: categoryId }),
        }
      );
      if (res.ok) {
        setAssignedCategoryId(categoryId);
        onAssigned?.(categoryId);
        alert("Application package assigned. The client can now fill the assigned forms in their dashboard (Pathway Recommendation step).");
      }
    } finally {
      setAssigning(false);
    }
  }

  function reset() { setSel1(""); setSel2(""); setSel3(""); }

  const level2 = sel1 !== "" ? (tree.find(n => n.id === sel1)?.children ?? []) : [];
  const level3 = sel2 !== "" ? (level2.find(n => n.id === sel2)?.children ?? []) : [];
  const selectedLeaf = sel3 !== "" ? level3.find(n => n.id === sel3) : undefined;
  const result = selectedLeaf?.result ?? null;
  const documents = selectedLeaf?.documents ?? [];
  const hasAnySelection = sel1 !== "" || sel2 !== "" || sel3 !== "";

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
            <FileText className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">IRCC Application Forms & Guides</p>
            <p className="text-xs text-muted-foreground">
              Select a package, then assign it so the client can access documents in their dashboard
            </p>
          </div>
        </div>
        {hasAnySelection && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
      </div>

      <div className="p-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">Loading IRCC data…</span>
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-rose-500 py-4 text-center">
            Could not load IRCC data. Please ensure the backend is running.
          </p>
        )}

        {!loading && !error && (
          <div className="space-y-0">
            <StepSelect step={1} stepLabel="What do you want to do?" placeholder="— Select a category —"
              value={sel1} options={tree} disabled={false}
              onChange={v => { setSel1(v); setSel2(""); setSel3(""); }} />
            <StepConnector active={sel1 !== ""} />
            <StepSelect step={2} stepLabel="Sub-category" placeholder="— Select a sub-category —"
              value={sel2} options={level2} disabled={sel1 === ""}
              onChange={v => { setSel2(v); setSel3(""); }} />
            <StepConnector active={sel2 !== ""} />
            <StepSelect step={3} stepLabel="Specific application" placeholder="— Select a specific application —"
              value={sel3} options={level3} disabled={sel2 === ""}
              onChange={v => setSel3(v)} />

            {result && selectedLeaf && (
              <div ref={resultRef} className="pt-4">
                <ResultCard
                  result={result}
                  applicationLabel={selectedLeaf.label}
                  documents={documents}
                  assignedCategoryId={assignedCategoryId}
                  selectedCategoryId={selectedLeaf.id}
                  assigning={assigning}
                  onAssign={() => assignPackage(selectedLeaf.id)}
                />
              </div>
            )}

            {!result && sel1 === "" && (
              <p className="text-xs text-muted-foreground text-center pt-4 pb-1">
                Select all 3 levels above to view and assign the application package to your client.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

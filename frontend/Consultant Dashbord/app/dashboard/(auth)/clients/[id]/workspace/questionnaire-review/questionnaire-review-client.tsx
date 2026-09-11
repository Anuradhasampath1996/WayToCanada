"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, Loader2, AlertCircle,
  ClipboardList, ShieldCheck, Pencil, Upload, FileText, X, Check,
  Eye, RotateCcw, MessageSquare, ImageIcon, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { WorkspaceSubpageHero } from "../workspace-subpage-hero";
import { INTAKE_WORKSPACE_TASKS } from "../workspace-flow-ui";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

const RELATIONSHIP_LABELS: Record<string, string> = {
  father: "Applicant's Father",
  mother: "Applicant's Mother",
  my_parent: "Applicant's Parent",
  spouse_father: "Spouse's Father",
  spouse_mother: "Spouse's Mother",
  spouse_parent: "Spouse's Parent",
  sibling: "Applicant's Sibling",
  in_law: "In-Law",
  other: "Other",
};

function relationshipLabel(person: Record<string, unknown> | null | undefined): string {
  if (!person) return "";
  const rel = String(person.relationship ?? "");
  if (rel === "other") {
    const other = String(person.otherRelationship ?? "").trim();
    return other || "Other";
  }
  return RELATIONSHIP_LABELS[rel] ?? (rel ? rel.replace(/_/g, " ") : "");
}

function accompanyingTabLabel(person: Record<string, unknown> | null | undefined, index: number): string {
  const rel = relationshipLabel(person);
  const name = String(person?.fullName ?? person?.passportFullName ?? "").trim();
  if (rel && name) return `(${rel}) ${name}`;
  if (rel) return `(${rel})`;
  if (name) return name;
  return `Person ${index + 1}`;
}

function childTabLabel(child: Record<string, unknown> | null | undefined, index: number): string {
  const name = String(child?.name ?? child?.fullName ?? child?.passportFullName ?? "").trim();
  return name ? `(Child) ${name}` : `Child ${index + 1}`;
}

function spouseTabLabel(spouse: Record<string, unknown> | null | undefined): string {
  const name = String(spouse?.fullName ?? spouse?.passportFullName ?? "").trim();
  return name ? `(Spouse) ${name}` : "Spouse";
}

// --- Types ---

interface FieldRemark {
  remark: string;
  requested_at: string;
  status: "pending" | "resolved";
}

interface Submission {
  id: number;
  is_submitted: boolean;
  submitted_at: string | null;
  step1_data:        Record<string, unknown> | null;
  main_data:         Record<string, unknown> | null;
  spouse_data:       Record<string, unknown> | null;
  children_data:     Record<string, unknown>[] | null;
  accompanying_data: Record<string, unknown>[] | null;
  verified_fields:   Record<string, boolean> | null;
  field_remarks:     Record<string, FieldRemark> | null;
}

type FieldType = "text" | "date" | "textarea" | "document";
type FieldDef  = {
  key: string;
  label: string;
  section: string;
  type?: FieldType;
  /** Hide row unless this returns true (e.g. otherRelationship only when relationship=other). */
  showWhen?: (data: Record<string, unknown>) => boolean;
};

// --- Field definitions ---

const STEP1_FIELDS: FieldDef[] = [
  { key: "fullName",          label: "Full Name",                            section: "Basic Information" },
  { key: "email",             label: "Email Address",                        section: "Basic Information" },
  { key: "whatsapp",          label: "WhatsApp Number",                      section: "Basic Information" },
  { key: "married",           label: "Marital Status",                       section: "Family" },
  { key: "dependentChildren", label: "Number of Dependent Children",         section: "Family" },
  { key: "hasAccompanying",   label: "Other Persons Accompanying?",          section: "Family" },
  { key: "accompanyingCount", label: "Number of Other Accompanying Persons", section: "Family" },
];

/** Main applicant Identity — name/email live in step1 + passport OCR, not relationship. */
const MAIN_IDENTITY_FIELDS: FieldDef[] = [
  { key: "fullName", label: "Full Name",     section: "Identity" },
  { key: "dob",      label: "Date of Birth", section: "Identity", type: "date" },
  { key: "email",    label: "Email",         section: "Identity" },
];

const SPOUSE_IDENTITY_FIELDS: FieldDef[] = [
  { key: "fullName", label: "Full Name",     section: "Identity" },
  { key: "dob",      label: "Date of Birth", section: "Identity", type: "date" },
  { key: "email",    label: "Email",         section: "Identity" },
];

const CHILD_IDENTITY_FIELDS: FieldDef[] = [
  { key: "name",  label: "Full Name",     section: "Identity" },
  { key: "dob",   label: "Date of Birth", section: "Identity", type: "date" },
  { key: "email", label: "Email",         section: "Identity" },
];

const ACCOMPANYING_IDENTITY_FIELDS: FieldDef[] = [
  { key: "fullName",          label: "Full Name",                    section: "Identity" },
  { key: "relationship",      label: "Relationship",                 section: "Identity" },
  {
    key: "otherRelationship",
    label: "Other Relationship (specify)",
    section: "Identity",
    showWhen: (d) => String(d.relationship ?? "") === "other",
  },
  { key: "dob",   label: "Date of Birth", section: "Identity", type: "date" },
  { key: "email", label: "Email",         section: "Identity" },
];

const PERSON_DETAIL_FIELDS: FieldDef[] = [
  { key: "passportFullName",       label: "Full Name (as on Passport)",              section: "Passport" },
  { key: "passportNumber",         label: "Passport Number",                         section: "Passport" },
  { key: "passportIssueDate",      label: "Date of Issue",                           section: "Passport",           type: "date" },
  { key: "passportExpiry",         label: "Expiry Date",                             section: "Passport",           type: "date" },
  { key: "passportNationality",    label: "Nationality / Country of Citizenship",    section: "Passport" },
  { key: "passportGender",         label: "Sex / Gender",                            section: "Passport" },
  { key: "passportName",           label: "Passport Document (PDF/Image)",           section: "Passport",           type: "document" },
  { key: "nicFullName",            label: "Full Name",                               section: "National ID / NIC" },
  { key: "nicNumber",              label: "ID Number",                               section: "National ID / NIC" },
  { key: "nicDob",                 label: "Date of Birth",                           section: "National ID / NIC",  type: "date" },
  { key: "nicAddress",             label: "Address on ID",                           section: "National ID / NIC",  type: "textarea" },
  { key: "nicBirthPlace",          label: "Birth Place",                             section: "National ID / NIC" },
  { key: "nicIssueDate",           label: "Date of Issue",                           section: "National ID / NIC",  type: "date" },
  { key: "governmentIdName",       label: "Govt. ID Front (PDF/Image)",              section: "National ID / NIC",  type: "document" },
  { key: "governmentIdBackName",   label: "Govt. ID Back (PDF/Image)",               section: "National ID / NIC",  type: "document" },
  { key: "drivingLicenseName",     label: "Driving License Front (PDF/Image)",       section: "National ID / NIC",  type: "document" },
  { key: "drivingLicenseBackName", label: "Driving License Back (PDF/Image)",        section: "National ID / NIC",  type: "document" },
  { key: "educationLevels",        label: "Education Level(s)",                      section: "Education" },
  { key: "studiedInCanada",        label: "Studied Full-Time in Canada (2+ Yrs)?",   section: "Canadian Study" },
  { key: "canadaStudyInstitution", label: "Institution / University Name",           section: "Canadian Study" },
  { key: "canadaStudyProgram",     label: "Program / Course",                        section: "Canadian Study" },
  { key: "canadaStudyCity",        label: "City in Canada",                          section: "Canadian Study" },
  { key: "canadaStudyStart",       label: "Start Date",                              section: "Canadian Study",     type: "date" },
  { key: "canadaStudyEnd",         label: "End Date",                                section: "Canadian Study",     type: "date" },
  { key: "canadaStudyDocName",     label: "Study Proof Document (PDF/Image)",        section: "Canadian Study",     type: "document" },
  { key: "languageTest",           label: "Has IELTS / CELPIP Test?",                section: "Language Test" },
  { key: "languageTestType",       label: "English Test Type (IELTS / CELPIP)",      section: "Language Test" },
  { key: "scores",                 label: "English Test Scores",                     section: "Language Test",      type: "textarea" },
  { key: "languageTestDocName",    label: "Language Test Certificate (PDF/Image)",   section: "Language Test",      type: "document" },
  { key: "frenchTestTaken",        label: "Has French Test (TEF / TCF)?",            section: "Language Test" },
  { key: "frenchTestType",         label: "French Test Type",                        section: "Language Test" },
  { key: "frenchScores",           label: "French Test Scores",                      section: "Language Test",      type: "textarea" },
  { key: "intendedNocCode",        label: "Target NOC Code (5 digits)",              section: "Target Occupation" },
  { key: "intendedNocTeer",        label: "NOC TEER Category",                       section: "Target Occupation" },
  { key: "intendedNocTitle",       label: "NOC Job Title",                           section: "Target Occupation" },
  { key: "tradeCertificate",       label: "Skilled Trade Certificate?",              section: "Target Occupation" },
  { key: "provincialNominationInterest", label: "Interested in PNP?",              section: "Provincial Nomination" },
  { key: "provincialNomination",   label: "Holds Provincial Nomination Certificate?", section: "Provincial Nomination" },
  { key: "workExperience",         label: "Total Skilled Foreign Work Experience",   section: "Work Experience" },
  { key: "foreignWorkEntries",     label: "Foreign Work History (company, title, dates)", section: "Work Experience" },
  { key: "settlementFunds",        label: "Settlement Funds Available (CAD)",        section: "Work Experience" },
  { key: "canadianWork",           label: "1 Year Authorized Canadian Work Exp.?",   section: "Canadian Work" },
  { key: "canadianWorkEmployer",   label: "Employer Name",                           section: "Canadian Work" },
  { key: "canadianWorkTitle",      label: "Job Title",                               section: "Canadian Work" },
  { key: "canadianWorkCity",       label: "City",                                    section: "Canadian Work" },
  { key: "canadianWorkStart",      label: "Start Date",                              section: "Canadian Work",      type: "date" },
  { key: "canadianWorkEnd",        label: "End Date",                                section: "Canadian Work",      type: "date" },
  { key: "jobOffer",               label: "Has Valid Job Offer from Canadian Employer?", section: "Job Offer" },
  { key: "jobOfferEmployer",       label: "Employer / Company Name",                 section: "Job Offer" },
  { key: "jobOfferTitle",          label: "Job Title / Position",                    section: "Job Offer" },
  { key: "jobOfferNoc",            label: "NOC Code",                                section: "Job Offer" },
  { key: "jobOfferProvince",       label: "Province / Territory",                    section: "Job Offer" },
  { key: "canadianRelatives",      label: "Sibling in Canada as PR / Citizen?",      section: "Relatives in Canada" },
  { key: "relativeFullName",       label: "Relative Full Name",                      section: "Relatives in Canada" },
  { key: "relativeRelationship",   label: "Relationship",                            section: "Relatives in Canada" },
  { key: "relativeCity",           label: "City in Canada",                          section: "Relatives in Canada" },
  { key: "relativeStatus",         label: "Immigration Status",                      section: "Relatives in Canada" },
];

/** Applicant-only IRCC / address fields used by IMM5476 autofill. */
const MAIN_ONLY_FIELDS: FieldDef[] = [
  { key: "uci",                    label: "Client ID / UCI",                         section: "IRCC Form Details" },
  { key: "birthCountry",           label: "Country of Birth",                        section: "IRCC Form Details" },
  { key: "imm5476ApplicationType", label: "IMM 5476 Application Type",               section: "IRCC Form Details" },
  { key: "addressLine1",           label: "Current Address Line 1",                  section: "Current Address" },
  { key: "addressLine2",           label: "Current Address Line 2",                  section: "Current Address" },
  { key: "city",                   label: "City / Town",                             section: "Current Address" },
  { key: "province",               label: "Province / State",                        section: "Current Address" },
  { key: "postalCode",             label: "Postal / ZIP Code",                       section: "Current Address" },
  { key: "countryOfResidence",     label: "Country of Residence",                    section: "Current Address" },
];

const PERSON_FIELDS: FieldDef[] = [
  ...MAIN_IDENTITY_FIELDS,
  ...MAIN_ONLY_FIELDS,
  ...PERSON_DETAIL_FIELDS,
];

const SPOUSE_FIELDS: FieldDef[] = [
  ...SPOUSE_IDENTITY_FIELDS,
  ...PERSON_DETAIL_FIELDS,
];

const CHILD_FIELDS: FieldDef[] = [
  ...CHILD_IDENTITY_FIELDS,
  ...PERSON_DETAIL_FIELDS,
];

const ACCOMPANYING_FIELDS: FieldDef[] = [
  ...ACCOMPANYING_IDENTITY_FIELDS,
  ...PERSON_DETAIL_FIELDS,
];

// --- Helpers ---

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatValue(val: unknown, fieldKey?: string): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (fieldKey === "relationship" && typeof val === "string") {
    return RELATIONSHIP_LABELS[val] ?? val.replace(/_/g, " ");
  }
  if (fieldKey === "otherRelationship" && (val === "N/A" || val === "n/a")) return "";
  if (Array.isArray(val)) {
    if (val.length === 0) return "";
    return val.map((v) => {
      if (typeof v === "object" && v !== null) {
        const row = v as Record<string, unknown>;
        if ("companyName" in row || "jobTitle" in row) {
          const when = row.currentlyWorking === "yes"
            ? `${row.startDate || "?"} – present`
            : `${row.startDate || "?"} – ${row.endDate || "?"}`;
          return `${row.jobTitle || "Role"} @ ${row.companyName || "Company"} (${row.country || "?"}, ${when})`;
        }
        return JSON.stringify(v);
      }
      return String(v);
    }).join(" · ");
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const parts = Object.entries(obj)
      .filter(([, v]) => v !== "" && v !== null && v !== undefined)
      .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`);
    return parts.length > 0 ? parts.join("  |  ") : "";
  }
  return String(val);
}

function hasValue(val: unknown): boolean {
  if (val === null || val === undefined || val === "") return false;
  if (val === "N/A" || val === "n/a") return false;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") {
    return Object.values(val as Record<string, unknown>).some(
      (v) => v !== "" && v !== null && v !== undefined
    );
  }
  return true;
}

/** Prefer identity name/email from passport OCR / step1 when person blob omits them. */
function withIdentityFallbacks(
  data: Record<string, unknown> | null,
  step1?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!data && !step1) return data;
  const out: Record<string, unknown> = { ...(data ?? {}) };
  const passportName = String(out.passportFullName ?? "").trim();
  const stepName = String(step1?.fullName ?? "").trim();
  const stepEmail = String(step1?.email ?? "").trim();
  const nicName = String(out.nicFullName ?? "").trim();

  if (!hasValue(out.fullName)) {
    const fallback = passportName || nicName || stepName;
    if (fallback) out.fullName = fallback;
  }
  if (!hasValue(out.name)) {
    const fallback = passportName || nicName || String(out.fullName ?? "").trim() || stepName;
    if (fallback) out.name = fallback;
  }
  if (!hasValue(out.email) && stepEmail) {
    out.email = stepEmail;
  }
  return out;
}

function visibleFields(fields: FieldDef[], data: Record<string, unknown> | null): FieldDef[] {
  const safe = data ?? {};
  return fields.filter((f) => !f.showWhen || f.showWhen(safe));
}

function fileBasename(path: string): string {
  return path.split("/").pop() ?? path;
}

type DocumentMediaType = "image" | "pdf" | "other";

function inferDocumentMediaType(path: string, blobMime: string): DocumentMediaType {
  if (blobMime.startsWith("image/")) return "image";
  if (blobMime === "application/pdf") return "pdf";
  const lower = path.toLowerCase();
  if (/\.(jpe?g|png|webp|gif)$/i.test(lower)) return "image";
  if (/\.pdf$/i.test(lower)) return "pdf";
  return "other";
}

function canStreamDocumentPath(path: string): boolean {
  return path.startsWith("client-document/") || /\.(jpe?g|png|webp|gif|pdf)$/i.test(path);
}

const IDENTITY_DOC_KEYS = new Set([
  "passportName",
  "governmentIdName",
  "governmentIdBackName",
  "drivingLicenseName",
  "drivingLicenseBackName",
]);

function authToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
}

function documentStreamUrl(profileId: string, filePath: string): string {
  return `${API}/consultant/clients/${profileId}/questionnaire/document/stream?path=${encodeURIComponent(filePath)}`;
}

function useAuthenticatedFileUrl(profileId: string, filePath: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<DocumentMediaType>("other");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!filePath || !canStreamDocumentPath(filePath)) {
      setUrl(null);
      setMediaType("other");
      setError(false);
      return;
    }

    let cancelled = false;
    let blobUrl: string | null = null;
    setLoading(true);
    setError(false);

    const token = authToken();
    fetch(documentStreamUrl(profileId, filePath), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error("load failed");
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
        setMediaType(inferDocumentMediaType(filePath, blob.type));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [profileId, filePath]);

  return { url, mediaType, loading, error };
}

function RequestRefillDialog({
  open,
  fieldLabel,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  fieldLabel: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (remark: string) => void;
}) {
  const [remark, setRemark] = useState("");

  useEffect(() => {
    if (open) setRemark("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request client to refill</DialogTitle>
          <DialogDescription>
            Add a note for <span className="font-medium text-foreground">{fieldLabel}</span>. The client will see this in their questionnaire.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          rows={4}
          placeholder="Explain what needs to be corrected or re-uploaded…"
          className="resize-y"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={() => onSubmit(remark.trim())}
            disabled={saving || !remark.trim()}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemarkBanner({ remark }: { remark: FieldRemark }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-500/[0.08] px-3 py-2">
      <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Refill requested</p>
        <p className="text-xs leading-relaxed text-amber-900">{remark.remark}</p>
      </div>
    </div>
  );
}

// --- Document Card ---

function DocCard({
  profileId, label, value, fieldKey, verified, remark, onVerify, onUpdate, onRequestRefill, verifySaving, refillSaving, compact,
}: {
  profileId: string;
  label: string;
  value: unknown;
  fieldKey: string;
  verified: boolean;
  remark?: FieldRemark;
  onVerify: (key: string) => void;
  onUpdate: (path: string, value: string) => Promise<void>;
  onRequestRefill: (key: string, label: string) => void;
  verifySaving: boolean;
  refillSaving: boolean;
  compact?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [localMediaType, setLocalMediaType] = useState<DocumentMediaType>("other");
  const fileRef = useRef<HTMLInputElement>(null);
  const currentPath = typeof value === "string" && value ? value : null;
  const displayName = currentPath ? fileBasename(currentPath) : "";
  const { url: previewUrl, mediaType: storedMediaType, loading: previewLoading, error: previewError } = useAuthenticatedFileUrl(profileId, currentPath);

  const activePreviewUrl = localPreviewUrl ?? previewUrl;
  const activeMediaType = localPreviewUrl ? localMediaType : storedMediaType;

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  useEffect(() => {
    if (!currentPath) {
      setLocalPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setLocalMediaType("other");
    }
  }, [currentPath]);

  async function handleFile(file: File) {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(objectUrl);
    setLocalMediaType(
      file.type.startsWith("image/")
        ? "image"
        : file.type === "application/pdf"
          ? "pdf"
          : inferDocumentMediaType(file.name, file.type),
    );

    setUploading(true);
    try {
      const token = authToken();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "client-document");
      const res = await fetch(`${API}/documents/upload`, {
        method: "POST",
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Upload failed");
      await onUpdate(fieldKey, json.path as string);
    } catch {
      // surfaced via parent toast
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <div className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors",
        verified ? "border-emerald-200/70" : remark ? "border-amber-200/70" : "border-border/70",
      )}>
        <div className="flex items-start justify-between gap-2 border-b border-border/50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">{label}</p>
            {displayName && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={currentPath ?? ""}>{displayName}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            {remark?.status === "pending" && (
              <Badge variant="outline" className="h-5 rounded-md border-amber-200 text-[10px] text-amber-800">Refill requested</Badge>
            )}
            {verified && (
              <Badge variant="outline" className="h-5 rounded-md border-emerald-200 text-[10px] text-emerald-700">Verified</Badge>
            )}
          </div>
        </div>

        <div className={cn(
          "relative overflow-hidden bg-slate-100/80",
          compact ? "aspect-[3/4] min-h-[200px]" : "aspect-[5/4]",
        )}>
          {uploading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-primary">
              <Loader2 className="size-5 animate-spin" />
              Uploading…
            </div>
          ) : currentPath ? (
            <>
              {previewLoading && !localPreviewUrl ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : activePreviewUrl && activeMediaType === "image" ? (
                <button
                  type="button"
                  className="group relative block h-full w-full cursor-zoom-in"
                  onClick={() => setPreviewOpen(true)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activePreviewUrl}
                    alt={label}
                    className={cn(
                      "h-full w-full bg-slate-950/5",
                      compact ? "object-cover" : "object-contain",
                    )}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ) : activePreviewUrl && activeMediaType === "pdf" ? (
                <button
                  type="button"
                  className="flex h-full w-full flex-col items-center justify-center gap-2 bg-white"
                  onClick={() => setPreviewOpen(true)}
                >
                  <iframe
                    src={activePreviewUrl}
                    title={label}
                    className="pointer-events-none h-full w-full border-0"
                  />
                </button>
              ) : previewError && !localPreviewUrl ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                  <AlertCircle className="size-8 text-amber-600" />
                  <span className="text-xs font-medium text-amber-900">File not found in storage</span>
                  <span className="text-[10px] leading-snug text-muted-foreground">
                    {displayName}
                    <br />
                    Click <span className="font-medium">Replace</span> below to upload again.
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:bg-muted/30"
                  onClick={() => setPreviewOpen(true)}
                >
                  <FileText className="size-10 opacity-40" />
                  <span className="text-xs font-medium">{displayName}</span>
                </button>
              )}
              {currentPath && (
                <div className="absolute bottom-2 right-2 z-10">
                  <Button size="sm" variant="secondary" className="h-7 gap-1 rounded-lg border-0 bg-white/90 text-xs shadow-md backdrop-blur-sm hover:bg-white" onClick={() => setPreviewOpen(true)}>
                    <Eye className="size-3.5" />
                    View
                  </Button>
                </div>
              )}
              {currentPath && activeMediaType === "image" && (
                <div className="absolute bottom-2 left-2 z-10 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm backdrop-blur-sm">
                  Uploaded
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-amber-700 transition-colors hover:bg-amber-500/[0.06]"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-8 opacity-60" />
              <span className="text-xs font-medium">Not uploaded</span>
              <span className="text-[11px] text-muted-foreground">PDF, JPG, PNG — up to 10 MB</span>
            </button>
          )}
        </div>

        {remark?.status === "pending" && (
          <div className="border-t border-border/50 px-4 py-3">
            <RemarkBanner remark={remark} />
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border/50 p-3">
          {verified && (
            <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              Verified
            </span>
          )}
          <Button size="sm" variant="outline" className="h-8 flex-1 gap-1.5 rounded-lg text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="size-3.5" />
            {currentPath ? "Replace" : "Upload"}
          </Button>
          {currentPath && !verified && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg border-emerald-200 text-xs text-emerald-700 hover:bg-emerald-50" onClick={() => onVerify(fieldKey)} disabled={verifySaving}>
              {verifySaving ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
              Verify
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 rounded-lg border-amber-200 text-xs text-amber-800 hover:bg-amber-50"
            onClick={() => onRequestRefill(fieldKey, label)}
            disabled={refillSaving}
          >
            {refillSaving ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            Request refill
          </Button>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>{displayName || "Document preview"}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto bg-muted/20 p-4">
            {activePreviewUrl && activeMediaType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activePreviewUrl} alt={label} className="mx-auto max-h-[65vh] w-auto max-w-full rounded-lg object-contain shadow-sm" />
            ) : activePreviewUrl && activeMediaType === "pdf" ? (
              <iframe src={activePreviewUrl} title={label} className="h-[65vh] w-full rounded-lg border bg-white shadow-sm" />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">Preview not available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </>
  );
}
// --- Text Field Row ---

function TextFieldRow({
  label, value, fieldKey, verified, remark, onVerify, onUpdate, onRequestRefill, verifySaving, refillSaving, type = "text",
}: {
  label: string; value: unknown; fieldKey: string; verified: boolean;
  remark?: FieldRemark;
  onVerify: (key: string) => void;
  onUpdate: (path: string, value: string) => Promise<void>;
  onRequestRefill: (key: string, label: string) => void;
  verifySaving: boolean;
  refillSaving: boolean;
  type?: "text" | "date" | "textarea";
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const [saving,  setSaving]  = useState(false);

  const fieldName = fieldKey.includes(".") ? fieldKey.split(".").pop()! : fieldKey;
  const displayVal = formatValue(value, fieldName);
  const isEmpty    = !displayVal;

  function startEdit() {
    const raw = typeof value === "string" ? value
      : typeof value === "object" && value !== null ? JSON.stringify(value, null, 2)
      : displayVal;
    setEditVal(raw);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onUpdate(fieldKey, editVal);
      setEditing(false);
    } catch {
      // error shown via toast
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn(
      "rounded-xl border px-4 py-3.5 transition-colors",
      verified ? "border-emerald-200/70 bg-emerald-500/[0.05]"
      : remark?.status === "pending" ? "border-amber-200/70 bg-amber-500/[0.05]"
      : isEmpty ? "border-amber-200/60 bg-amber-500/[0.04]"
      : "border-border/60 bg-card hover:border-border",
    )}>
      {editing ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
          <div className="flex items-start gap-2">
            {type === "textarea" ? (
              <textarea
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                rows={3}
                className="flex-1 resize-y rounded-lg border border-input/80 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            ) : (
              <input
                autoFocus
                type={type}
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                className="flex-1 rounded-lg border border-input/80 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            )}
            <div className="mt-0.5 flex shrink-0 gap-1.5">
              <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 gap-1 rounded-lg px-3">
                {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                {remark?.status === "pending" && (
                  <Badge variant="outline" className="h-5 rounded-md border-amber-200 text-[10px] text-amber-800">Refill requested</Badge>
                )}
              </div>
              {isEmpty ? (
                <p className="text-sm font-medium italic text-amber-700">Not filled — click edit to add</p>
              ) : (
                <p className={cn("whitespace-pre-wrap break-words text-sm font-medium", verified ? "text-emerald-900" : "text-foreground")}>
                  {displayVal}
                </p>
              )}
            </div>
            <div className="mt-0.5 flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
              <button
                type="button"
                onClick={startEdit}
                title="Edit this field"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <Pencil className="size-3.5" />
              </button>
              {verified ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="size-4" />
                  Verified
                </span>
              ) : null}
              {!isEmpty && !verified && (
                <Button size="sm" variant="outline" className="h-7 rounded-lg px-2.5 text-xs" onClick={() => onVerify(fieldKey)} disabled={verifySaving}>
                  {verifySaving ? <Loader2 className="size-3 animate-spin" /> : "Verify"}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 rounded-lg border-amber-200 px-2.5 text-xs text-amber-800 hover:bg-amber-50"
                onClick={() => onRequestRefill(fieldKey, label)}
                disabled={refillSaving}
              >
                {refillSaving ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                Refill
              </Button>
            </div>
          </div>
          {remark?.status === "pending" && <RemarkBanner remark={remark} />}
        </>
      )}
    </div>
  );
}

// --- Person Tab ---

function PersonTab({
  profileId, fields, data, prefix, verifiedFields, fieldRemarks, onVerify, onUpdate, onRequestRefill, savingKey, refillKey,
}: {
  profileId: string;
  fields: FieldDef[];
  data: Record<string, unknown> | null;
  prefix: string;
  verifiedFields: Record<string, boolean>;
  fieldRemarks: Record<string, FieldRemark>;
  onVerify: (key: string) => void;
  onUpdate: (path: string, value: string) => Promise<void>;
  onRequestRefill: (key: string, label: string) => void;
  savingKey: string | null;
  refillKey: string | null;
}) {
  const safeData = data ?? {};
  const visible = visibleFields(fields, safeData);
  const sections = new Map<string, FieldDef[]>();
  for (const f of visible) {
    const list = sections.get(f.section) ?? [];
    list.push(f);
    sections.set(f.section, list);
  }

  const identityDocs = visible.filter((f) => f.type === "document" && IDENTITY_DOC_KEYS.has(f.key));
  const hasIdentityDocs = identityDocs.length > 0;

  return (
    <div className="space-y-8">
      {hasIdentityDocs && (
        <section className="overflow-hidden rounded-2xl border border-violet-200/50 bg-gradient-to-br from-violet-500/[0.04] to-background shadow-sm">
          <div className="border-b border-border/50 px-5 py-4">
            <h3 className="text-sm font-semibold">Identity documents</h3>
            <p className="text-xs text-muted-foreground">Passport, national ID, and driving license uploaded by the client</p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {identityDocs.map((f) => {
              const fk = `${prefix}.${f.key}`;
              return (
                <DocCard
                  key={fk}
                  profileId={profileId}
                  label={f.label}
                  value={safeData[f.key]}
                  fieldKey={fk}
                  verified={!!verifiedFields[fk]}
                  remark={fieldRemarks[fk]}
                  onVerify={onVerify}
                  onUpdate={onUpdate}
                  onRequestRefill={onRequestRefill}
                  verifySaving={savingKey === fk}
                  refillSaving={refillKey === fk}
                  compact
                />
              );
            })}
          </div>
        </section>
      )}

      {Array.from(sections.entries()).map(([section, sectionFields]) => {
        const textFields = sectionFields.filter((f) => (f.type ?? "text") !== "document");
        const otherDocs = sectionFields.filter((f) => f.type === "document" && !IDENTITY_DOC_KEYS.has(f.key));
        if (textFields.length === 0 && otherDocs.length === 0) return null;

        return (
          <section key={section} className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/50 bg-muted/10 px-5 py-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section}</p>
            </div>
            <div className="space-y-3 p-5">
              {textFields.length > 0 && (
                <div className="space-y-2.5">
                  {textFields.map((f) => {
                    const fk = `${prefix}.${f.key}`;
                    const ft = f.type ?? "text";
                    return (
                      <TextFieldRow
                        key={fk}
                        label={f.label}
                        value={safeData[f.key]}
                        fieldKey={fk}
                        verified={!!verifiedFields[fk]}
                        remark={fieldRemarks[fk]}
                        onVerify={onVerify}
                        onUpdate={onUpdate}
                        onRequestRefill={onRequestRefill}
                        verifySaving={savingKey === fk}
                        refillSaving={refillKey === fk}
                        type={ft === "textarea" ? "textarea" : ft === "date" ? "date" : "text"}
                      />
                    );
                  })}
                </div>
              )}

              {otherDocs.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {otherDocs.map((f) => {
                    const fk = `${prefix}.${f.key}`;
                    return (
                      <DocCard
                        key={fk}
                        profileId={profileId}
                        label={f.label}
                        value={safeData[f.key]}
                        fieldKey={fk}
                        verified={!!verifiedFields[fk]}
                        remark={fieldRemarks[fk]}
                        onVerify={onVerify}
                        onUpdate={onUpdate}
                        onRequestRefill={onRequestRefill}
                        verifySaving={savingKey === fk}
                        refillSaving={refillKey === fk}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
// --- Count verified/total ---

function countTab(tabId: string, submission: Submission, vf: Record<string, boolean>) {
  let total = 0; let verified = 0;
  const count = (data: Record<string, unknown> | null, prefix: string, fields: FieldDef[]) => {
    if (!data) return;
    for (const f of visibleFields(fields, data)) {
      const empty = !hasValue(data[f.key]);
      if (!empty || f.type === "document") {
        total++;
        if (vf[`${prefix}.${f.key}`]) verified++;
      }
    }
  };

  const step1 = submission.step1_data;
  if (tabId === "step1")       count(step1,  "step1_data",  STEP1_FIELDS);
  else if (tabId === "main")   count(withIdentityFallbacks(submission.main_data, step1),   "main_data",   PERSON_FIELDS);
  else if (tabId === "spouse") count(withIdentityFallbacks(submission.spouse_data), "spouse_data", SPOUSE_FIELDS);
  else if (tabId.startsWith("child_")) {
    const idx = parseInt(tabId.replace("child_", ""), 10);
    count(withIdentityFallbacks((submission.children_data ?? [])[idx] ?? null), `children_data.${idx}`, CHILD_FIELDS);
  } else if (tabId.startsWith("other_")) {
    const idx = parseInt(tabId.replace("other_", ""), 10);
    count(withIdentityFallbacks((submission.accompanying_data ?? [])[idx] ?? null), `accompanying_data.${idx}`, ACCOMPANYING_FIELDS);
  }
  return { verified, total };
}

/** Keys eligible for bulk verify: has value (or document path), not already verified, not pending refill. */
function collectVerifiableFieldKeys(
  submission: Submission,
  vf: Record<string, boolean>,
  fr: Record<string, { status: string }>,
): string[] {
  const keys: string[] = [];
  const push = (data: Record<string, unknown> | null, prefix: string, fields: FieldDef[]) => {
    if (!data) return;
    for (const f of visibleFields(fields, data)) {
      const key = `${prefix}.${f.key}`;
      if (vf[key]) continue;
      if (fr[key]?.status === "pending") continue;
      const empty = !hasValue(data[f.key]);
      if (empty && f.type !== "document") continue;
      if (f.type === "document" && empty) continue;
      keys.push(key);
    }
  };

  const step1 = submission.step1_data;
  push(step1, "step1_data", STEP1_FIELDS);
  push(withIdentityFallbacks(submission.main_data, step1), "main_data", PERSON_FIELDS);
  if (step1?.married === "yes") {
    push(withIdentityFallbacks(submission.spouse_data), "spouse_data", SPOUSE_FIELDS);
  }
  const children = submission.children_data ?? [];
  const accompanying = submission.accompanying_data ?? [];
  const childCount = Math.max(
    parseInt(String(step1?.dependentChildren ?? "0"), 10) || 0,
    children.length,
  );
  const otherCount = Math.max(
    step1?.hasAccompanying === "yes" ? (parseInt(String(step1?.accompanyingCount ?? "0"), 10) || 0) : 0,
    accompanying.length,
  );
  for (let i = 0; i < childCount; i++) {
    push(withIdentityFallbacks((children[i] ?? null) as Record<string, unknown> | null), `children_data.${i}`, CHILD_FIELDS);
  }
  for (let i = 0; i < otherCount; i++) {
    push(withIdentityFallbacks((accompanying[i] ?? null) as Record<string, unknown> | null), `accompanying_data.${i}`, ACCOMPANYING_FIELDS);
  }
  return keys;
}

// --- Main component ---

export function QuestionnaireReviewClient({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("step1");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [refillKey, setRefillKey] = useState<string | null>(null);
  const [refillDialog, setRefillDialog] = useState<{ fieldKey: string; label: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [bulkVerifying, setBulkVerifying] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API}/consultant/clients/${id}/questionnaire`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to load.");
      setSubmission(json.submission ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleVerify = async (fieldKey: string) => {
    setSavingKey(fieldKey);
    try {
      const res  = await fetch(`${API}/consultant/clients/${id}/questionnaire/verify`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ field_key: fieldKey, verified: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Verification failed.");
      setSubmission((prev) => prev ? { ...prev, verified_fields: json.verified_fields } : prev);
      showToast("Field verified.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Verification failed.", "error");
    } finally {
      setSavingKey(null);
    }
  };

  const handleVerifyAllNonFlagged = async () => {
    if (!submission || bulkVerifying) return;
    const keys = collectVerifiableFieldKeys(
      submission,
      submission.verified_fields ?? {},
      submission.field_remarks ?? {},
    );
    if (keys.length === 0) {
      showToast("Nothing left to verify (empty fields and pending refills are skipped).", "error");
      return;
    }
    setBulkVerifying(true);
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/questionnaire/verify-all`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ field_keys: keys }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Bulk verify failed.");
      setSubmission((prev) => prev ? { ...prev, verified_fields: json.verified_fields } : prev);
      const flagged = (json.skipped_flagged as string[] | undefined)?.length ?? 0;
      showToast(
        flagged > 0
          ? `Verified ${json.verified_count ?? 0} field(s). ${flagged} pending refill(s) skipped.`
          : `Verified ${json.verified_count ?? 0} field(s).`,
      );
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Bulk verify failed.", "error");
    } finally {
      setBulkVerifying(false);
    }
  };

  const handleUpdate = async (path: string, value: string) => {
    try {
      const res  = await fetch(`${API}/consultant/clients/${id}/questionnaire/field`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ path, value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Save failed.");
      setSubmission(json.submission as Submission);
      showToast("Saved successfully.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Save failed.", "error");
      throw e;
    }
  };

  const openRequestRefill = (fieldKey: string, label: string) => {
    setRefillDialog({ fieldKey, label });
  };

  const handleRequestRefill = async (remark: string) => {
    if (!refillDialog) return;
    setRefillKey(refillDialog.fieldKey);
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/questionnaire/request-refill`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ field_key: refillDialog.fieldKey, remark }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Request failed.");
      setSubmission((prev) => prev ? {
        ...prev,
        field_remarks: json.field_remarks,
        verified_fields: json.verified_fields,
      } : prev);
      setRefillDialog(null);
      showToast("Refill request sent to client.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Request failed.", "error");
    } finally {
      setRefillKey(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4 text-center">
      <AlertCircle className="h-10 w-10 text-red-400" />
      <p className="text-lg font-semibold">{error}</p>
      <Button variant="outline" asChild>
        <Link href={`/dashboard/clients/${id}/workspace`}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back to Intake &amp; pathway
        </Link>
      </Button>
    </div>
  );

  const vf = submission?.verified_fields ?? {};
  const fr = submission?.field_remarks ?? {};
  const s1 = submission?.step1_data ?? null;
  const pendingRefills = Object.values(fr).filter((r) => r.status === "pending").length;

  const isMarried  = s1?.married === "yes";
  const children = submission?.children_data ?? [];
  const accompanying = submission?.accompanying_data ?? [];
  const childCount = Math.max(
    parseInt(String(s1?.dependentChildren ?? "0"), 10) || 0,
    children.length,
  );
  const otherCount = Math.max(
    s1?.hasAccompanying === "yes" ? (parseInt(String(s1?.accompanyingCount ?? "0"), 10) || 0) : 0,
    accompanying.length,
  );

  const tabs: { id: string; label: string }[] = [
    { id: "step1", label: "General Info" },
    { id: "main",  label: "Main Applicant" },
    ...(isMarried ? [{ id: "spouse", label: spouseTabLabel(submission?.spouse_data ?? null) }] : []),
    ...Array.from({ length: childCount }, (_, i) => ({
      id: `child_${i}`,
      label: childTabLabel(children[i] ?? null, i),
    })),
    ...Array.from({ length: otherCount }, (_, i) => ({
      id: `other_${i}`,
      label: accompanyingTabLabel(accompanying[i] ?? null, i),
    })),
  ];

  const commonProps = {
    profileId: id,
    verifiedFields: vf,
    fieldRemarks: fr,
    onVerify: handleVerify,
    onUpdate: handleUpdate,
    onRequestRefill: openRequestRefill,
    savingKey,
    refillKey,
  };

  function renderContent(tabId: string) {
    if (!submission) return null;
    if (tabId === "step1") return <PersonTab fields={STEP1_FIELDS} data={submission.step1_data} prefix="step1_data" {...commonProps} />;
    if (tabId === "main") {
      return (
        <PersonTab
          fields={PERSON_FIELDS}
          data={withIdentityFallbacks(submission.main_data, submission.step1_data)}
          prefix="main_data"
          {...commonProps}
        />
      );
    }
    if (tabId === "spouse") {
      return (
        <PersonTab
          fields={SPOUSE_FIELDS}
          data={withIdentityFallbacks(submission.spouse_data)}
          prefix="spouse_data"
          {...commonProps}
        />
      );
    }
    if (tabId.startsWith("child_")) {
      const idx = parseInt(tabId.replace("child_", ""), 10);
      return (
        <PersonTab
          fields={CHILD_FIELDS}
          data={withIdentityFallbacks((submission.children_data ?? [])[idx] ?? null)}
          prefix={`children_data.${idx}`}
          {...commonProps}
        />
      );
    }
    if (tabId.startsWith("other_")) {
      const idx = parseInt(tabId.replace("other_", ""), 10);
      return (
        <PersonTab
          fields={ACCOMPANYING_FIELDS}
          data={withIdentityFallbacks((submission.accompanying_data ?? [])[idx] ?? null)}
          prefix={`accompanying_data.${idx}`}
          {...commonProps}
        />
      );
    }
    return null;
  }

  const totalVerified = Object.keys(vf).length;

  return (
    <div className="min-w-0 w-full overflow-x-hidden pb-4">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-3 left-3 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg sm:left-auto sm:max-w-sm",
          toast.type === "success" ? "bg-white border-green-200 text-green-800" : "bg-white border-red-200 text-red-700"
        )}>
          {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      <WorkspaceSubpageHero
        profileId={id}
        stepLabel="Step 1 · Intake & pathway"
        title="Questionnaire review"
        description="Review client answers and uploaded identity documents. Verify correct fields or request a refill with a remark."
        illustration={INTAKE_WORKSPACE_TASKS[0].illustration}
        illustrationAlt={INTAKE_WORKSPACE_TASKS[0].illustrationAlt}
      >
        {totalVerified > 0 && (
          <Badge variant="outline" className="h-7 gap-1.5 rounded-lg border-emerald-200 bg-emerald-500/10 text-emerald-800">
            <ShieldCheck className="size-3.5" />
            {totalVerified} verified
          </Badge>
        )}
        {pendingRefills > 0 && (
          <Badge variant="outline" className="h-7 gap-1.5 rounded-lg border-amber-200 bg-amber-500/10 text-amber-800">
            <RotateCcw className="size-3.5" />
            {pendingRefills} refill request{pendingRefills === 1 ? "" : "s"}
          </Badge>
        )}
        {!submission?.is_submitted && (
          <Badge variant="outline" className="h-7 gap-1.5 rounded-lg border-amber-200 bg-amber-500/10 text-amber-800">
            <Clock className="size-3.5" />
            Awaiting client submission
          </Badge>
        )}
        {submission && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 rounded-lg"
            disabled={bulkVerifying}
            onClick={() => void handleVerifyAllNonFlagged()}
          >
            {bulkVerifying ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
            Verify all non-flagged
          </Button>
        )}
      </WorkspaceSubpageHero>

      <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-5">
        {submission?.is_submitted ? (
          <Badge className="h-7 gap-1.5 rounded-lg bg-blue-600 text-white">
            <CheckCircle2 className="size-3.5" />
            Submitted
          </Badge>
        ) : (
          <Badge variant="outline" className="h-7 rounded-lg border-amber-200 text-amber-800">
            Draft
          </Badge>
        )}
      </div>

      <div className="mb-6 mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { tone: "amber", icon: <Pencil className="size-3.5" />, text: "Empty or pending — edit or request refill" },
          { tone: "neutral", icon: <Check className="size-3.5" />, text: "Answered — verify when information is correct" },
          { tone: "emerald", icon: <ShieldCheck className="size-3.5" />, text: "Verified — still editable; editing clears verify until you confirm again" },
        ].map(({ tone, icon, text }) => (
          <div
            key={tone}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs",
              tone === "amber" ? "border-amber-200/70 bg-amber-500/[0.06] text-amber-900"
              : tone === "emerald" ? "border-emerald-200/70 bg-emerald-500/[0.06] text-emerald-900"
              : "border-border/70 bg-card text-muted-foreground",
            )}
          >
            {icon}
            <span>{text}</span>
          </div>
        ))}
      </div>

      {!submission ? (
        <div className="rounded-2xl border border-dashed bg-muted/10 p-14 text-center">
          <ClipboardList className="mx-auto mb-3 size-12 text-muted-foreground/30" />
          <p className="font-semibold">No questionnaire data yet</p>
          <p className="mt-1 text-sm text-muted-foreground">The client has not started the questionnaire. You can fill it here on their behalf.</p>
          <Button className="mt-4 rounded-lg" onClick={load} variant="outline" size="sm">Refresh</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              const { verified: vc, total: tc } = countTab(tab.id, submission, vf);
              const allDone = tc > 0 && vc === tc;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-violet-600 text-white shadow-sm"
                      : "border border-border/70 bg-card text-muted-foreground hover:bg-muted/30",
                  )}
                >
                  {allDone && <ShieldCheck className={cn("size-3.5", activeTab === tab.id ? "text-emerald-200" : "text-emerald-600")} />}
                  {tab.label}
                  {tc > 0 && (
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      activeTab === tab.id
                        ? allDone ? "bg-emerald-500 text-white" : "bg-white/20 text-white"
                        : allDone ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground",
                    )}>
                      {vc}/{tc}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="min-h-[320px]">
            {renderContent(activeTab)}
          </div>
        </div>
      )}

      <RequestRefillDialog
        open={Boolean(refillDialog)}
        fieldLabel={refillDialog?.label ?? ""}
        saving={Boolean(refillKey)}
        onClose={() => setRefillDialog(null)}
        onSubmit={handleRequestRefill}
      />
    </div>
  );
}
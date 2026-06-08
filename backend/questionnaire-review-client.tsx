"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, Loader2, AlertCircle,
  ClipboardList, ShieldCheck, Pencil, Upload, FileText, X, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// --- Types ---

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
}

type FieldType = "text" | "date" | "textarea" | "document";
type FieldDef  = { key: string; label: string; section: string; type?: FieldType };

// --- Field definitions ---

const STEP1_FIELDS: FieldDef[] = [
  { key: "fullName",          label: "Full Name",                            section: "Basic Information" },
  { key: "email",             label: "Email Address",                        section: "Basic Information" },
  { key: "whatsapp",          label: "WhatsApp Number",                      section: "Basic Information" },
  { key: "visaType",          label: "Intended Visa Type",                   section: "Basic Information" },
  { key: "married",           label: "Marital Status",                       section: "Family" },
  { key: "dependentChildren", label: "Number of Dependent Children",         section: "Family" },
  { key: "hasAccompanying",   label: "Other Persons Accompanying?",          section: "Family" },
  { key: "accompanyingCount", label: "Number of Other Accompanying Persons", section: "Family" },
];

const PERSON_FIELDS: FieldDef[] = [
  { key: "fullName",               label: "Full Name",                               section: "Identity" },
  { key: "dob",                    label: "Date of Birth",                           section: "Identity",           type: "date" },
  { key: "passportFullName",       label: "Full Name (as on Passport)",              section: "Passport" },
  { key: "passportNumber",         label: "Passport Number",                         section: "Passport" },
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
  { key: "scores",                 label: "Test Scores",                             section: "Language Test",      type: "textarea" },
  { key: "languageTestDocName",    label: "Language Test Certificate (PDF/Image)",   section: "Language Test",      type: "document" },
  { key: "workExperience",         label: "Total Skilled Foreign Work Experience",   section: "Work Experience" },
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

// --- Helpers ---

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) {
    if (val.length === 0) return "";
    return val.map((v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : String(v))).join(", ");
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
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") {
    return Object.values(val as Record<string, unknown>).some(
      (v) => v !== "" && v !== null && v !== undefined
    );
  }
  return true;
}

function fileBasename(path: string): string {
  return path.split("/").pop() ?? path;
}

// --- Document Field Row ---

function DocumentFieldRow({
  label, value, fieldKey, verified, onVerify, onUpdate, verifySaving,
}: {
  label: string; value: unknown; fieldKey: string; verified: boolean;
  onVerify: (key: string) => void;
  onUpdate: (path: string, value: string) => Promise<void>;
  verifySaving: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef    = useRef<HTMLInputElement>(null);
  const currentPath = typeof value === "string" && value ? value : null;

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "client-document");
      const res  = await fetch(`${API}/documents/upload`, {
        method: "POST",
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Upload failed");
      await onUpdate(fieldKey, json.path as string);
    } catch {
      // handled in parent via toast
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className={cn(
      "rounded-lg border px-4 py-3 transition-colors",
      verified ? "bg-green-50 border-green-200" : "bg-white border-slate-200"
    )}>
      <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {currentPath ? (
            <>
              <FileText className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="text-sm text-slate-700 truncate" title={currentPath}>
                {fileBasename(currentPath)}
              </span>
              <span className="text-xs text-green-600 font-semibold shrink-0">✓ Uploaded</span>
            </>
          ) : (
            <span className="text-sm text-amber-600 italic font-medium">No document uploaded</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!verified && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1.5"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {uploading ? "Uploading..." : currentPath ? "Re-upload" : "Upload"}
              </Button>
              {currentPath && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs border-slate-300"
                  onClick={() => onVerify(fieldKey)}
                  disabled={verifySaving}
                >
                  {verifySaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                </Button>
              )}
            </>
          )}
          {verified && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs font-semibold text-green-700">Verified</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Text Field Row ---

function TextFieldRow({
  label, value, fieldKey, verified, onVerify, onUpdate, verifySaving, type = "text",
}: {
  label: string; value: unknown; fieldKey: string; verified: boolean;
  onVerify: (key: string) => void;
  onUpdate: (path: string, value: string) => Promise<void>;
  verifySaving: boolean;
  type?: "text" | "date" | "textarea";
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const [saving,  setSaving]  = useState(false);

  const displayVal = formatValue(value);
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
      "rounded-lg border px-4 py-3 transition-colors",
      verified  ? "bg-green-50 border-green-200"
      : isEmpty ? "bg-amber-50/60 border-amber-200"
      :           "bg-white border-slate-200 hover:bg-slate-50/50"
    )}>
      {editing ? (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
          <div className="flex gap-2 items-start">
            {type === "textarea" ? (
              <textarea
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                rows={3}
                className="flex-1 text-sm rounded-md border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
              />
            ) : (
              <input
                autoFocus
                type={type}
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                className="flex-1 text-sm rounded-md border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            )}
            <div className="flex gap-1.5 shrink-0 mt-0.5">
              <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 px-3 gap-1">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
            {isEmpty ? (
              <p className="text-sm text-amber-600 italic font-medium">Not filled — click pencil to add</p>
            ) : (
              <p className={cn(
                "text-sm font-medium break-words whitespace-pre-wrap",
                verified ? "text-green-900" : "text-slate-800"
              )}>
                {displayVal}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            {!verified && (
              <button
                onClick={startEdit}
                title="Edit this field"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {verified ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-xs font-semibold text-green-700">Verified</span>
              </>
            ) : !isEmpty ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs border-slate-300"
                onClick={() => onVerify(fieldKey)}
                disabled={verifySaving}
              >
                {verifySaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Section Group ---

function SectionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// --- Person Tab ---

function PersonTab({
  fields, data, prefix, verifiedFields, onVerify, onUpdate, savingKey,
}: {
  fields: FieldDef[];
  data: Record<string, unknown> | null;
  prefix: string;
  verifiedFields: Record<string, boolean>;
  onVerify: (key: string) => void;
  onUpdate: (path: string, value: string) => Promise<void>;
  savingKey: string | null;
}) {
  const safeData = data ?? {};
  const sections = new Map<string, FieldDef[]>();
  for (const f of fields) {
    const list = sections.get(f.section) ?? [];
    list.push(f);
    sections.set(f.section, list);
  }

  return (
    <div>
      {Array.from(sections.entries()).map(([section, sectionFields]) => (
        <SectionGroup key={section} title={section}>
          {sectionFields.map((f) => {
            const fk         = `${prefix}.${f.key}`;
            const isVerified = !!verifiedFields[fk];
            const fieldType  = f.type ?? "text";

            if (fieldType === "document") {
              return (
                <DocumentFieldRow
                  key={fk}
                  label={f.label}
                  value={safeData[f.key]}
                  fieldKey={fk}
                  verified={isVerified}
                  onVerify={onVerify}
                  onUpdate={onUpdate}
                  verifySaving={savingKey === fk}
                />
              );
            }
            return (
              <TextFieldRow
                key={fk}
                label={f.label}
                value={safeData[f.key]}
                fieldKey={fk}
                verified={isVerified}
                onVerify={onVerify}
                onUpdate={onUpdate}
                verifySaving={savingKey === fk}
                type={fieldType === "textarea" ? "textarea" : fieldType === "date" ? "date" : "text"}
              />
            );
          })}
        </SectionGroup>
      ))}
    </div>
  );
}

// --- Count verified/total ---

function countTab(tabId: string, submission: Submission, vf: Record<string, boolean>) {
  let total = 0; let verified = 0;
  const count = (data: Record<string, unknown> | null, prefix: string, fields: FieldDef[]) => {
    if (!data) return;
    for (const f of fields) {
      const empty = !hasValue(data[f.key]);
      if (!empty || f.type === "document") {
        total++;
        if (vf[`${prefix}.${f.key}`]) verified++;
      }
    }
  };

  if (tabId === "step1")       count(submission.step1_data,  "step1_data",  STEP1_FIELDS);
  else if (tabId === "main")   count(submission.main_data,   "main_data",   PERSON_FIELDS);
  else if (tabId === "spouse") count(submission.spouse_data, "spouse_data", PERSON_FIELDS);
  else if (tabId.startsWith("child_")) {
    const idx = parseInt(tabId.replace("child_", ""), 10);
    count((submission.children_data ?? [])[idx] ?? null, `children_data.${idx}`, PERSON_FIELDS);
  } else if (tabId.startsWith("other_")) {
    const idx = parseInt(tabId.replace("other_", ""), 10);
    count((submission.accompanying_data ?? [])[idx] ?? null, `accompanying_data.${idx}`, PERSON_FIELDS);
  }
  return { verified, total };
}

// --- Main component ---

export function QuestionnaireReviewClient({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [activeTab,  setActiveTab]  = useState("step1");
  const [savingKey,  setSavingKey]  = useState<string | null>(null);
  const [toast,      setToast]      = useState<{ msg: string; type: "success" | "error" } | null>(null);

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
      showToast("Field verified and locked.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Verification failed.", "error");
    } finally {
      setSavingKey(null);
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
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Link>
      </Button>
    </div>
  );

  const vf = submission?.verified_fields ?? {};
  const s1 = submission?.step1_data ?? null;

  const isMarried  = s1?.married === "yes";
  const childCount = parseInt(String(s1?.dependentChildren ?? "0"), 10) || 0;
  const otherCount = parseInt(String(s1?.accompanyingCount  ?? "0"), 10) || 0;
  const hasOther   = s1?.hasAccompanying === "yes";

  const tabs: { id: string; label: string }[] = [
    { id: "step1", label: "General Info" },
    { id: "main",  label: "Main Applicant" },
    ...(isMarried ? [{ id: "spouse", label: "Spouse" }] : []),
    ...Array.from({ length: childCount }, (_, i) => ({ id: `child_${i}`, label: `Child ${i + 1}` })),
    ...(hasOther ? Array.from({ length: otherCount }, (_, i) => ({ id: `other_${i}`, label: `Person ${i + 1}` })) : []),
  ];

  const commonProps = { verifiedFields: vf, onVerify: handleVerify, onUpdate: handleUpdate, savingKey };

  function renderContent(tabId: string) {
    if (!submission) return null;
    if (tabId === "step1")   return <PersonTab fields={STEP1_FIELDS}  data={submission.step1_data}  prefix="step1_data"  {...commonProps} />;
    if (tabId === "main")    return <PersonTab fields={PERSON_FIELDS} data={submission.main_data}   prefix="main_data"   {...commonProps} />;
    if (tabId === "spouse")  return <PersonTab fields={PERSON_FIELDS} data={submission.spouse_data} prefix="spouse_data" {...commonProps} />;
    if (tabId.startsWith("child_")) {
      const idx = parseInt(tabId.replace("child_", ""), 10);
      return <PersonTab fields={PERSON_FIELDS} data={(submission.children_data ?? [])[idx] ?? null} prefix={`children_data.${idx}`} {...commonProps} />;
    }
    if (tabId.startsWith("other_")) {
      const idx = parseInt(tabId.replace("other_", ""), 10);
      return <PersonTab fields={PERSON_FIELDS} data={(submission.accompanying_data ?? [])[idx] ?? null} prefix={`accompanying_data.${idx}`} {...commonProps} />;
    }
    return null;
  }

  const totalVerified = Object.keys(vf).length;

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg max-w-sm",
          toast.type === "success" ? "bg-white border-green-200 text-green-800" : "bg-white border-red-200 text-red-700"
        )}>
          {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Back */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/dashboard/clients/${id}/workspace`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />Back to Workspace
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Questionnaire Review
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Edit empty fields, upload documents, then verify each answer to lock it.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {totalVerified > 0 && (
            <Badge className="bg-green-100 text-green-800 border border-green-200 gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              {totalVerified} verified
            </Badge>
          )}
          {submission?.is_submitted ? (
            <Badge className="bg-blue-50 text-blue-800 border border-blue-200">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Submitted
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">Draft</Badge>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        {[
          { color: "amber",  icon: <Pencil className="h-3.5 w-3.5 shrink-0" />,     text: "Orange = not filled — click ✎ to fill" },
          { color: "slate",  icon: <Check className="h-3.5 w-3.5 shrink-0" />,      text: "White = answered — verify when confirmed" },
          { color: "green",  icon: <ShieldCheck className="h-3.5 w-3.5 shrink-0" />, text: "Green = verified — locked from editing" },
        ].map(({ color, icon, text }) => (
          <div key={color} className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2",
            color === "amber" ? "border-amber-200 bg-amber-50 text-amber-800"
            : color === "green" ? "border-green-200 bg-green-50 text-green-800"
            : "border-slate-200 bg-white text-slate-600"
          )}>
            {icon}<span>{text}</span>
          </div>
        ))}
      </div>

      {!submission ? (
        <div className="rounded-xl border bg-slate-50 p-14 text-center">
          <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-semibold">No questionnaire data yet</p>
          <p className="text-slate-400 text-sm mt-1">The client has not filled the questionnaire. You can fill it here.</p>
          <Button className="mt-4" onClick={load} variant="outline" size="sm">Refresh</Button>
        </div>
      ) : (
        <div>
          {/* Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
            {tabs.map((tab) => {
              const { verified: vc, total: tc } = submission ? countTab(tab.id, submission, vf) : { verified: 0, total: 0 };
              const allDone = tc > 0 && vc === tc;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors shrink-0",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {allDone && <ShieldCheck className="h-3.5 w-3.5 text-green-400" />}
                  {tab.label}
                  {tc > 0 && (
                    <span className={cn(
                      "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      activeTab === tab.id
                        ? allDone ? "bg-green-500 text-white" : "bg-white/25 text-white"
                        : allDone ? "bg-green-600 text-white" : "bg-slate-300 text-slate-600"
                    )}>
                      {vc}/{tc}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="rounded-xl border bg-slate-50 p-5 shadow-sm min-h-[300px]">
            {renderContent(activeTab)}
          </div>
        </div>
      )}
    </div>
  );
}

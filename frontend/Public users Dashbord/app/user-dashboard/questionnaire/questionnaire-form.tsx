"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useIAQNav } from "@/context/questionnaire-nav-context";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ChevronLeft, ChevronRight, Check, Send,
  CheckCircle2, AlertCircle, User, Users, Baby, UserPlus,
  Upload, FileText, Car, CreditCard, Loader2, Eye, X, Star,
  RotateCcw, MessageSquare, Camera, ShieldAlert, ShieldCheck, Sparkles, Plus, Trash2,
} from "lucide-react";

import { Button }           from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input }            from "@/components/ui/input";
import { Label }            from "@/components/ui/label";
import { Badge }            from "@/components/ui/badge";
import { Separator }        from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { FieldRemark } from "@/lib/client-questionnaire-stats";
import { clientToConsultantKey, getPendingRemark, remarkLabel } from "@/lib/client-field-remarks";
import { ClientJourneyPageChrome } from "@/components/client-workspace-ui";
import { useClientJourneyOptional } from "@/context/client-journey-context";

// â”€â”€ API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type RemarkTabKind = "step1" | "main" | "spouse" | "child" | "accompanying";

function remarkFor(
  remarks: Record<string, FieldRemark> | undefined,
  tabKind: RemarkTabKind,
  field: string,
  index?: number,
): FieldRemark | undefined {
  return getPendingRemark(remarks ?? {}, clientToConsultantKey(tabKind, field, index));
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const local = localStorage.getItem("wtc_token");
  if (local) return local;
  const m = document.cookie.match(/(?:^|;\s*)wtc_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function saveToServer(data: FormData): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API}/questionnaire`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      step1_data: {
        fullName:          data.fullName,
        email:             data.email,
        whatsapp:          data.whatsapp,
        visaType:          data.visaType,
        married:           data.married,
        dependentChildren: data.dependentChildren,
        hasAccompanying:   data.hasAccompanying,
        accompanyingCount: data.accompanyingCount,
      },
      main_data:         data.main,
      spouse_data:       data.spouse,
      children_data:     data.children,
      accompanying_data: data.accompanying,
      step3_data: {
        eduLevels: data.eduLevels, eduQualifications: data.eduQualifications,
        spouseEduLevel: data.spouseEduLevel,
        currentJobTitle: data.currentJobTitle, currentJobField: data.currentJobField,
        totalExpYears: data.totalExpYears, continuousFullTime: data.continuousFullTime,
        workCategory: data.workCategory, spouseExpYears: data.spouseExpYears,
        intlTestTaken: data.intlTestTaken, intlTestType: data.intlTestType,
        intlTestScores: data.intlTestScores, expectedClb: data.expectedClb,
        frenchProficiency: data.frenchProficiency,
        fundsLkrRange: data.fundsLkrRange, canInvestStudent: data.canInvestStudent,
        relativeInCountry: data.relativeInCountry, prevEduAbroad: data.prevEduAbroad,
        prevWorkAbroad: data.prevWorkAbroad, hasJobOffer: data.hasJobOffer,
        hasMedicalCondition: data.hasMedicalCondition,
        hasCriminalRecord: data.hasCriminalRecord, hasVisaRefusal: data.hasVisaRefusal,
      },
    }),
  });
  if (!res.ok) throw new Error("Autosave failed");
}

async function uploadDocumentFile(file: File): Promise<string> {
  const token = getToken();
  const fd = new globalThis.FormData();
  fd.append("file", file);
  fd.append("type", "client-document");
  const res = await fetch(`${API}/documents/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) throw new Error("Upload failed");
  const json = await res.json();
  return (json.path as string) ?? file.name;
}

// â”€â”€ OCR microservice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


interface OcrExtracted {
  fullName?: string;
  passportNumber?: string;
  idNumber?: string;
  dob?: string;
  expiryDate?: string;
  issueDate?: string;
  nationality?: string;
  gender?: string;
  address?: string;
  birthPlace?: string;
  // Education document fields
  institutionName?: string;
  degreeName?: string;
  graduationYear?: string;
  country?: string;
  // Language test score fields
  testListening?: string; testReading?: string; testWriting?: string; testSpeaking?: string;
  testOverall?: string; testDate?: string;
}

interface EduQualification {
  level: string;
  universityName: string;
  courseName: string;
  graduationYear: string;
  country: string;
  documentName: string;
}

interface ForeignWorkEntry {
  companyName: string;
  jobTitle: string;
  country: string;
  city: string;
  startDate: string;
  endDate: string;
  currentlyWorking: string; // yes | no | ""
  duties: string;
}

function emptyForeignWorkEntry(): ForeignWorkEntry {
  return {
    companyName: "",
    jobTitle: "",
    country: "",
    city: "",
    startDate: "",
    endDate: "",
    currentlyWorking: "no",
    duties: "",
  };
}

interface OcrAuthenticity {
  verdict: "likely_authentic" | "needs_review" | "suspicious" | "likely_fake" | "unknown";
  score: number;
  summary?: string;
  flags?: string[];
}

interface OcrResult {
  status: "success" | "partial_success";
  document_type: "passport" | "national_id" | "driving_license" | "education" | "language_test" | "study_permit" | "unknown";
  extracted_data: OcrExtracted;
  confidence_score: number;
  message?: string;
  authenticity?: OcrAuthenticity;
  engine?: string;
}

type ScanKind = "passport" | "id" | "licence" | "education" | "language" | "study";

function mapPassportGender(g?: string): string {
  if (!g) return "";
  const u = g.trim().toUpperCase();
  if (u === "M" || u === "MALE") return "Male";
  if (u === "F" || u === "FEMALE") return "Female";
  if (u === "X" || u === "OTHER" || u === "UNSPECIFIED") return "Other";
  return "";
}

/** Keep only values that <input type="date"> will accept. */
function toInputDate(value?: string): string {
  if (!value) return "";
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function passportOcrPatch(d: OcrExtracted): Record<string, string> {
  const patch: Record<string, string> = {};
  const dob = toInputDate(d.dob);
  const issue = toInputDate(d.issueDate);
  const expiry = toInputDate(d.expiryDate);
  if (dob) patch.dob = dob;
  if (d.fullName?.trim()) patch.passportFullName = d.fullName.trim();
  if (d.passportNumber?.trim()) patch.passportNumber = d.passportNumber.trim().toUpperCase();
  if (issue) patch.passportIssueDate = issue;
  if (expiry) patch.passportExpiry = expiry;
  if (d.nationality?.trim()) patch.passportNationality = d.nationality.trim();
  const gender = mapPassportGender(d.gender);
  if (gender) patch.passportGender = gender;
  return patch;
}

function applyPassportOcrFields(
  d: OcrExtracted,
  onField: (field: string, value: string) => void,
) {
  const patch = passportOcrPatch(d);
  for (const [field, value] of Object.entries(patch)) {
    onField(field, value);
  }
}

function applyPassportOcrPatch(
  d: OcrExtracted,
  onPatch: (patch: Record<string, string>) => void,
) {
  const patch = passportOcrPatch(d);
  if (Object.keys(patch).length > 0) onPatch(patch);
}

function hasUsefulPassportFields(d: OcrExtracted | undefined): boolean {
  if (!d) return false;
  return Object.keys(passportOcrPatch(d)).length > 0;
}

function hasUsefulExtractedFields(d: OcrExtracted | undefined): boolean {
  if (!d) return false;
  return Object.values(d).some((v) => typeof v === "string" && v.trim() !== "");
}

function authenticityTone(verdict?: OcrAuthenticity["verdict"]): {
  label: string;
  className: string;
} {
  switch (verdict) {
    case "likely_authentic":
      return { label: "Looks authentic", className: "border-green-200 bg-green-50 text-green-800" };
    case "needs_review":
      return { label: "Needs review", className: "border-amber-200 bg-amber-50 text-amber-900" };
    case "suspicious":
      return { label: "Suspicious", className: "border-orange-200 bg-orange-50 text-orange-900" };
    case "likely_fake":
      return { label: "Likely fake / AI", className: "border-red-200 bg-red-50 text-red-800" };
    default:
      return { label: "Authenticity unknown", className: "border-border bg-muted/40 text-muted-foreground" };
  }
}

function inferStoredDocumentMediaType(path: string, blobMime: string): "image" | "pdf" | "other" {
  if (blobMime.startsWith("image/")) return "image";
  if (blobMime === "application/pdf") return "pdf";
  const lower = path.toLowerCase();
  if (/\.(jpe?g|png|webp|gif)$/i.test(lower)) return "image";
  if (/\.pdf$/i.test(lower)) return "pdf";
  return "other";
}

function isStoredDocumentPath(path: string): boolean {
  return path.startsWith("client-document/");
}

function scanKindMismatch(kind: ScanKind, documentType: OcrResult["document_type"]): string | null {
  if (documentType === "unknown") return null;
  if (kind === "passport" && documentType !== "passport") {
    return "This image does not look like a passport bio-data page. Upload the photo page with MRZ lines at the bottom.";
  }
  if (kind === "id" && documentType === "passport") {
    return "This looks like a passport, not a government ID card.";
  }
  if (kind === "licence" && documentType === "passport") {
    return "This looks like a passport, not a driving licence.";
  }
  if (kind === "education" && ["passport", "national_id", "driving_license"].includes(documentType)) {
    return "This looks like an identity document, not an education certificate.";
  }
  if (kind === "language" && documentType !== "language_test") {
    return "This may not be a language test score report. Please verify.";
  }
  return null;
}

async function scanDocumentFile(
  file: File,
  documentHint?: ScanKind,
): Promise<{ result: OcrResult | null; error: string | null }> {
  try {
    const fd = new globalThis.FormData();
    fd.append("file", file);
    if (documentHint) fd.append("document_hint", documentHint);
    const token = getToken();
    const res = await fetch(`${API}/documents/scan`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { result: null, error: (json as { message?: string }).message ?? `Scan failed (${res.status})` };
    }
    return { result: json as OcrResult, error: null };
  } catch {
    return { result: null, error: "Could not reach the scan service. Check that the OCR service is running." };
  }
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ScoreSet { listening: string; reading: string; writing: string; speaking: string }
interface MainData {
  dob: string; educationLevels: string[]; educationQuals: EduQualification[]; studiedInCanada: string;
  languageTest: string; scores: ScoreSet;
  languageTestType: string;
  frenchTestTaken: string; frenchTestType: string; frenchScores: ScoreSet;
  intendedNocCode: string; intendedNocTeer: string; intendedNocTitle: string;
  tradeCertificate: string; provincialNominationInterest: string; provincialNomination: string;
  workExperience: string; canadianWork: string;
  foreignWorkEntries: ForeignWorkEntry[];
  jobOffer: string; settlementFunds: string; canadianRelatives: string;
  passportName: string; governmentIdName: string; governmentIdBackName: string;
  drivingLicenseName: string; drivingLicenseBackName: string;
  // Passport details
  passportFullName: string; passportNumber: string; passportIssueDate: string; passportExpiry: string;
  passportNationality: string; passportGender: string;
  // NIC / ID details
  nicFullName: string; nicNumber: string; nicDob: string; nicAddress: string;
  nicBirthPlace: string; nicIssueDate: string;
  // Canada study details
  canadaStudyInstitution: string; canadaStudyProgram: string; canadaStudyCity: string;
  canadaStudyStart: string; canadaStudyEnd: string; canadaStudyDocName: string;
  // Language test document
  languageTestDocName: string;
  // Canadian work details
  canadianWorkEmployer: string; canadianWorkTitle: string;
  canadianWorkStart: string; canadianWorkEnd: string; canadianWorkCity: string;
  // Job offer details
  jobOfferEmployer: string; jobOfferTitle: string; jobOfferNoc: string; jobOfferProvince: string;
  // Relative details
  relativeFullName: string; relativeRelationship: string; relativeCity: string; relativeStatus: string;
  languages: string[];
}
interface SpouseData {
  fullName: string; dob: string; educationLevels: string[]; educationQuals: EduQualification[];
  languageTest: string; languageTestType: string; scores: ScoreSet;
  frenchTestTaken: string; frenchTestType: string; frenchScores: ScoreSet;
  workExperience: string;
  foreignWorkEntries: ForeignWorkEntry[];
  canadianWork: string;
  passportName: string; governmentIdName: string; governmentIdBackName: string;
  drivingLicenseName: string; drivingLicenseBackName: string;
  // Passport details
  passportFullName: string; passportNumber: string; passportIssueDate: string; passportExpiry: string;
  passportNationality: string; passportGender: string;
  // NIC / ID details
  nicFullName: string; nicNumber: string; nicDob: string; nicAddress: string;
  nicBirthPlace: string; nicIssueDate: string;
  // Language test document
  languageTestDocName: string;
  // Spouse Canadian work details
  canadianWorkEmployer: string; canadianWorkTitle: string;
  canadianWorkStart: string; canadianWorkEnd: string; canadianWorkCity: string;
  languages: string[];
}
interface ChildData {
  name: string; dob: string; educationLevel: string;
  passportName: string; governmentIdName: string; governmentIdBackName: string;
  drivingLicenseName: string; drivingLicenseBackName: string;
  // Passport details
  passportFullName: string; passportNumber: string; passportIssueDate: string; passportExpiry: string;
  passportNationality: string; passportGender: string;
  // NIC / ID details
  nicFullName: string; nicNumber: string; nicDob: string; nicAddress: string;
  nicBirthPlace: string; nicIssueDate: string;
  languages: string[];
}
interface AccompanyingPerson {
  fullName: string; dob: string;
  relationship: string; otherRelationship: string;
  passportName: string; governmentIdName: string; governmentIdBackName: string;
  drivingLicenseName: string; drivingLicenseBackName: string;
  // Passport details
  passportFullName: string; passportNumber: string; passportIssueDate: string; passportExpiry: string;
  passportNationality: string; passportGender: string;
  // NIC / ID details
  nicFullName: string; nicNumber: string; nicDob: string; nicAddress: string;
  nicBirthPlace: string; nicIssueDate: string;
  languages: string[];
}

interface FormData {
  fullName: string; email: string; whatsapp: string;
  visaType: string; married: string; dependentChildren: string;
  hasAccompanying: string; accompanyingCount: string;
  main: MainData; spouse: SpouseData; children: ChildData[];
  accompanying: AccompanyingPerson[];
  // Step 3 — Immigration Assessment
  eduLevels: string[]; eduQualifications: EduQualification[]; spouseEduLevel: string;
  currentJobTitle: string; currentJobField: string; totalExpYears: string;
  continuousFullTime: string; workCategory: string; spouseExpYears: string;
  intlTestTaken: string; intlTestType: string; intlTestScores: ScoreSet;
  expectedClb: string; frenchProficiency: string;
  fundsLkrRange: string; canInvestStudent: string;
  relativeInCountry: string; prevEduAbroad: string;
  prevWorkAbroad: string; hasJobOffer: string;
  hasMedicalCondition: string; hasCriminalRecord: string; hasVisaRefusal: string;
}

const EMPTY_SCORES: ScoreSet = { listening: "", reading: "", writing: "", speaking: "" };

const INITIAL: FormData = {
  fullName: "", email: "", whatsapp: "", visaType: "",
  married: "", dependentChildren: "0",
  hasAccompanying: "", accompanyingCount: "1",
  // Step 3
  eduLevels: [], eduQualifications: [], spouseEduLevel: "",
  currentJobTitle: "", currentJobField: "", totalExpYears: "",
  continuousFullTime: "", workCategory: "", spouseExpYears: "",
  intlTestTaken: "", intlTestType: "", intlTestScores: { listening: "", reading: "", writing: "", speaking: "" },
  expectedClb: "", frenchProficiency: "",
  fundsLkrRange: "", canInvestStudent: "",
  relativeInCountry: "", prevEduAbroad: "",
  prevWorkAbroad: "", hasJobOffer: "",
  hasMedicalCondition: "", hasCriminalRecord: "", hasVisaRefusal: "",
  main: {
    dob: "", educationLevels: [], educationQuals: [], studiedInCanada: "", languageTest: "",
    languageTestType: "ielts", frenchTestTaken: "", frenchTestType: "none",
    frenchScores: { ...EMPTY_SCORES },
    intendedNocCode: "", intendedNocTeer: "", intendedNocTitle: "",
    tradeCertificate: "", provincialNominationInterest: "", provincialNomination: "",
    scores: { ...EMPTY_SCORES },
    workExperience: "", canadianWork: "", jobOffer: "",
    foreignWorkEntries: [],
    settlementFunds: "", canadianRelatives: "",
    passportName: "", governmentIdName: "", governmentIdBackName: "",
    drivingLicenseName: "", drivingLicenseBackName: "",
    passportFullName: "", passportNumber: "", passportIssueDate: "", passportExpiry: "",
  passportNationality: "", passportGender: "",
  nicFullName: "", nicNumber: "", nicDob: "", nicAddress: "",
  nicBirthPlace: "", nicIssueDate: "",
  canadaStudyInstitution: "", canadaStudyProgram: "", canadaStudyCity: "",
  canadaStudyStart: "", canadaStudyEnd: "", canadaStudyDocName: "",
  languageTestDocName: "",
  canadianWorkEmployer: "", canadianWorkTitle: "", canadianWorkStart: "", canadianWorkEnd: "", canadianWorkCity: "",
  jobOfferEmployer: "", jobOfferTitle: "", jobOfferNoc: "", jobOfferProvince: "",
  relativeFullName: "", relativeRelationship: "", relativeCity: "", relativeStatus: "",
  languages: [],
  },
  spouse: {
    fullName: "", dob: "", educationLevels: [], educationQuals: [], languageTest: "",
    languageTestType: "ielts", frenchTestTaken: "", frenchTestType: "tef",
    frenchScores: { ...EMPTY_SCORES },
    workExperience: "",
    foreignWorkEntries: [],
    scores: { ...EMPTY_SCORES }, canadianWork: "",
    passportName: "", governmentIdName: "", governmentIdBackName: "",
    drivingLicenseName: "", drivingLicenseBackName: "",
    passportFullName: "", passportNumber: "", passportIssueDate: "", passportExpiry: "",
  passportNationality: "", passportGender: "",
  nicFullName: "", nicNumber: "", nicDob: "", nicAddress: "",
  nicBirthPlace: "", nicIssueDate: "",
  languageTestDocName: "",
  canadianWorkEmployer: "", canadianWorkTitle: "", canadianWorkStart: "", canadianWorkEnd: "", canadianWorkCity: "",
  languages: [],
  },
  children: [],
  accompanying: [],
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  my_parent:     "My Parent",
  spouse_parent: "Spouse's Parent",
  sibling:       "My Sibling",
  in_law:        "In-Law",
  other:         "Other",
};

function childCount(val: string) {
  if (val === "4+") return 4;
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

function accompanyingCount(val: string) {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

// â”€â”€ Shared field wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Field({
  label, required, error, children, refillRemark,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
  refillRemark?: FieldRemark;
}) {
  return (
    <div className={cn("space-y-1.5", refillRemark && "rounded-lg border border-amber-300 bg-amber-50/40 p-2.5")}>
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
        {refillRemark && (
          <Badge variant="outline" className="ml-2 text-[10px] border-amber-300 bg-amber-100 text-amber-900">
            Correction requested
          </Badge>
        )}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {refillRemark && (
        <p className="flex items-start gap-1.5 text-xs text-amber-900">
          <MessageSquare className="mt-0.5 size-3.5 shrink-0" />
          <span>{refillRemark.remark}</span>
        </p>
      )}
    </div>
  );
}

// â”€â”€ IELTS score inputs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ScoreInputs({
  scores,
  onChange,
}: {
  scores: ScoreSet;
  onChange: (f: keyof ScoreSet, v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
      {(["listening", "reading", "writing", "speaking"] as (keyof ScoreSet)[]).map((f) => (
        <div key={f} className="space-y-1">
          <Label className="text-xs capitalize text-muted-foreground">{f}</Label>
          <Input
            type="number" min={0} max={9} step={0.5}
            value={scores[f]}
            onChange={(e) => onChange(f, e.target.value)}
            placeholder="0–9"
            className="text-center"
          />
        </div>
      ))}
    </div>
  );
}

// â”€â”€ Step indicator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1 as const, label: "General Info" },
    { n: 2 as const, label: "Detailed Profile" },
    { n: 3 as const, label: "Review & Submit" },
  ];

  return (
    <>
      <div className="mb-4 space-y-2 sm:hidden">
        {steps.map((s) => (
          <div
            key={s.n}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              step === s.n ? "border-primary bg-primary/5 font-medium" : step > s.n ? "border-green-200 bg-green-50/50" : "border-border text-muted-foreground",
            )}
          >
            <div className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
              step === s.n ? "bg-primary text-primary-foreground" : step > s.n ? "bg-green-500 text-white" : "bg-muted text-muted-foreground",
            )}>
              {step > s.n ? <Check className="h-3 w-3" /> : s.n}
            </div>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="mb-6 hidden items-center gap-3 overflow-x-auto sm:flex">
      {/* Step 1 */}
      <div className="flex items-center gap-2 shrink-0">
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
          step === 1
            ? "border-primary bg-primary text-primary-foreground"
            : "border-green-500 bg-green-500 text-white",
        )}>
          {step > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}
        </div>
        <span className={cn("text-sm font-medium", step === 1 ? "text-foreground" : "text-muted-foreground")}>
          General Info
        </span>
      </div>

      <Separator className="flex-1" />

      {/* Step 2 */}
      <div className="flex items-center gap-2 shrink-0">
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
          step === 2
            ? "border-primary bg-primary text-primary-foreground"
            : step > 2
              ? "border-green-500 bg-green-500 text-white"
              : "border-muted-foreground/30 bg-background text-muted-foreground/40",
        )}>
          {step > 2 ? <Check className="h-3.5 w-3.5" /> : "2"}
        </div>
        <span className={cn("text-sm font-medium", step === 2 ? "text-foreground" : "text-muted-foreground/50")}>
          Detailed Profile
        </span>
      </div>

      <Separator className="flex-1" />

      {/* Step 3 */}
      <div className="flex items-center gap-2 shrink-0">
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
          step === 3
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30 bg-background text-muted-foreground/40",
        )}>
          3
        </div>
        <span className={cn("text-sm font-medium", step === 3 ? "text-foreground" : "text-muted-foreground/50")}>
          Review &amp; Submit
        </span>
      </div>
    </div>
    </>
  );
}

// â”€â”€ Step 1 form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Step1Form({
  data, errors, fieldRemarks,
  onChange,
  onSpouseName,
  onChildName,
  onAccompanyingName,
}: {
  data: FormData;
  errors: Record<string, string>;
  fieldRemarks?: Record<string, FieldRemark>;
  onChange: (f: keyof FormData, v: string) => void;
  onSpouseName?: (name: string) => void;
  onChildName?: (i: number, name: string) => void;
  onAccompanyingName?: (i: number, name: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Full Name" required error={errors.fullName}
          refillRemark={remarkFor(fieldRemarks, "step1", "fullName")}>
          <Input
            value={data.fullName}
            onChange={(e) => onChange("fullName", e.target.value)}
            placeholder="As in Passport"
          />
        </Field>

        <Field label="Email Address" required error={errors.email}
          refillRemark={remarkFor(fieldRemarks, "step1", "email")}>
          <Input
            type="email"
            value={data.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="your@email.com"
          />
        </Field>

        <Field label="WhatsApp Number" required error={errors.whatsapp}
          refillRemark={remarkFor(fieldRemarks, "step1", "whatsapp")}>
          <Input
            value={data.whatsapp}
            onChange={(e) => onChange("whatsapp", e.target.value)}
            placeholder="+1 234 567 8900"
          />
        </Field>
      </div>

      <Separator />

      <div className="space-y-5">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Family Accompanying Details
        </h3>

        <Field label="Are you legally married or in a common-law relationship?" required error={errors.married}>
          <RadioGroup
            value={data.married}
            onValueChange={(v) => onChange("married", v)}
            className="flex gap-6 pt-1"
          >
            {["yes", "no"].map((v) => (
              <div key={v} className="flex items-center space-x-2">
                <RadioGroupItem value={v} id={`married-${v}`} />
                <Label htmlFor={`married-${v}`} className="font-normal capitalize cursor-pointer">{v === "yes" ? "Yes" : "No"}</Label>
              </div>
            ))}
          </RadioGroup>
        </Field>

        <Field label="How many dependent children are accompanying you?">
          <Select value={data.dependentChildren} onValueChange={(v) => onChange("dependentChildren", v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0 — No children</SelectItem>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4+">4+</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Are any other persons accompanying you? (parents, in-laws, siblings, others)"
          required
          error={errors.hasAccompanying}
        >
          <RadioGroup
            value={data.hasAccompanying}
            onValueChange={(v) => onChange("hasAccompanying", v)}
            className="flex gap-6 pt-1"
          >
            {["yes", "no"].map((v) => (
              <div key={v} className="flex items-center space-x-2">
                <RadioGroupItem value={v} id={`accompanying-${v}`} />
                <Label htmlFor={`accompanying-${v}`} className="font-normal cursor-pointer">
                  {v === "yes" ? "Yes" : "No"}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </Field>

        {data.hasAccompanying === "yes" && (
          <Field label="How many other persons are accompanying you?">
            <Select
              value={data.accompanyingCount}
              onValueChange={(v) => onChange("accompanyingCount", v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["1", "2", "3", "4", "5"].map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {(data.married === "yes" || childCount(data.dependentChildren) > 0 || data.hasAccompanying === "yes") && (
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Family Members — Full Names
              </p>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Only enter names for family members who are also expected to come to Canada with you.
                If someone will not accompany you, leave their name blank.
              </p>
            </div>
            {data.married === "yes" && (
              <Field label="Spouse's Full Name">
                <Input
                  value={data.spouse.fullName}
                  onChange={(e) => onSpouseName?.(e.target.value)}
                  placeholder="As in passport"
                />
              </Field>
            )}
            {Array.from({ length: childCount(data.dependentChildren) }).map((_, i) => (
              <Field key={i} label={`Child ${i + 1} Full Name`}>
                <Input
                  value={data.children[i]?.name ?? ""}
                  onChange={(e) => onChildName?.(i, e.target.value)}
                  placeholder={`Child ${i + 1}'s full name`}
                />
              </Field>
            ))}
            {data.hasAccompanying === "yes" && Array.from({ length: accompanyingCount(data.accompanyingCount) }).map((_, i) => (
              <Field key={`acc-${i}`} label={`Other Person ${i + 1} Full Name`}>
                <Input
                  value={data.accompanying[i]?.fullName ?? ""}
                  onChange={(e) => onAccompanyingName?.(i, e.target.value)}
                  placeholder="Full name as in passport"
                />
              </Field>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€ Tab: Main Applicant â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface NocSuggestion {
  code: string;
  teer: string;
  title: string;
  why?: string;
}

function ForeignWorkEntriesEditor({
  entries,
  onChange,
  personLabel = "your",
}: {
  entries: ForeignWorkEntry[];
  onChange: (next: ForeignWorkEntry[]) => void;
  personLabel?: string;
}) {
  const list = entries ?? [];

  function update(i: number, patch: Partial<ForeignWorkEntry>) {
    const next = list.map((row, idx) => (idx === i ? { ...row, ...patch } : row));
    onChange(next);
  }

  function remove(i: number) {
    onChange(list.filter((_, idx) => idx !== i));
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Foreign work history details</p>
          <p className="text-xs text-muted-foreground">
            Add each company {personLabel} worked for outside Canada — job title and dates help your consultant assess eligibility.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={() => onChange([...list, emptyForeignWorkEntry()])}
        >
          <Plus className="h-4 w-4" />
          Add job
        </Button>
      </div>

      {list.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          No jobs added yet. Click <strong>Add job</strong> to enter employer, role, and dates.
        </p>
      )}

      {list.map((row, i) => (
        <div key={i} className="rounded-xl border bg-background p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Job {i + 1}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-destructive hover:text-destructive"
              onClick={() => remove(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Company / Employer" required>
              <Input
                value={row.companyName}
                onChange={(e) => update(i, { companyName: e.target.value })}
                placeholder="Company name"
              />
            </Field>
            <Field label="Job title" required>
              <Input
                value={row.jobTitle}
                onChange={(e) => update(i, { jobTitle: e.target.value })}
                placeholder="e.g. Software Engineer"
              />
            </Field>
            <Field label="Country" required>
              <Input
                value={row.country}
                onChange={(e) => update(i, { country: e.target.value })}
                placeholder="e.g. Sri Lanka"
              />
            </Field>
            <Field label="City">
              <Input
                value={row.city}
                onChange={(e) => update(i, { city: e.target.value })}
                placeholder="e.g. Colombo"
              />
            </Field>
            <Field label="Start date" required>
              <Input
                type="date"
                value={row.startDate}
                onChange={(e) => update(i, { startDate: e.target.value })}
              />
            </Field>
            <Field label="Currently working here?">
              <Select
                value={row.currentlyWorking || undefined}
                onValueChange={(v) => update(i, {
                  currentlyWorking: v,
                  endDate: v === "yes" ? "" : row.endDate,
                })}
              >
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes — current job</SelectItem>
                  <SelectItem value="no">No — ended</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {row.currentlyWorking !== "yes" && (
              <Field label="End date" required>
                <Input
                  type="date"
                  value={row.endDate}
                  onChange={(e) => update(i, { endDate: e.target.value })}
                />
              </Field>
            )}
            <Field label="Main duties (brief)">
              <Input
                value={row.duties}
                onChange={(e) => update(i, { duties: e.target.value })}
                placeholder="What did you do day-to-day?"
              />
            </Field>
          </div>
        </div>
      ))}
    </div>
  );
}

function NocSmartLookup({
  code,
  teer,
  title,
  onApply,
}: {
  code: string;
  teer: string;
  title: string;
  onApply: (patch: { code?: string; teer?: string; title?: string }) => void;
}) {
  const [query, setQuery] = useState(title || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<NocSuggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedRef = useRef("");

  async function fetchSuggestions(raw: string, autoApplyTop = false) {
    const q = raw.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setError(null);
      return;
    }
    if (q === lastFetchedRef.current && suggestions.length > 0 && !autoApplyTop) return;
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${API}/noc/suggest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query: q }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSuggestions([]);
        setError((json as { message?: string }).message ?? "Could not look up NOC.");
        return;
      }
      const list = Array.isArray((json as { suggestions?: NocSuggestion[] }).suggestions)
        ? (json as { suggestions: NocSuggestion[] }).suggestions
        : [];
      setSuggestions(list);
      lastFetchedRef.current = q;
      if (autoApplyTop && list[0]) {
        applySuggestion(list[0]);
      }
    } catch {
      setSuggestions([]);
      setError("Could not reach NOC lookup. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function applySuggestion(s: NocSuggestion) {
    onApply({ code: s.code, teer: s.teer, title: s.title });
    setQuery(s.title);
    setError(null);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(value, false);
    }, 700);
  }

  function onCodeChange(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, 5);
    const patch: { code?: string; teer?: string } = { code: next };
    if (next.length === 5 && /^[0-5]/.test(next)) {
      patch.teer = next[0];
    }
    onApply(patch);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="space-y-3">
      <Field label="Describe your job (plain words)">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (debounceRef.current) clearTimeout(debounceRef.current);
                void fetchSuggestions(query, true);
              }
            }}
            placeholder="e.g. software developer, chef, accountant, truck driver…"
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            disabled={loading || query.trim().length < 3}
            onClick={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              void fetchSuggestions(query, true);
            }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Find NOC
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Type at least 3 characters — suggestions appear automatically. Click <strong>Find NOC</strong> to fill the top match.
        </p>
      </Field>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Suggested NOC codes — tap to apply</p>
          <div className="space-y-1.5">
            {suggestions.map((s) => {
              const selected = code === s.code;
              return (
                <button
                  key={`${s.code}-${s.title}`}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={selected ? "default" : "secondary"} className="font-mono text-[10px]">
                      {s.code}
                    </Badge>
                    <span className="text-[10px] font-medium text-muted-foreground">TEER {s.teer}</span>
                    <span className="text-xs font-semibold text-foreground">{s.title}</span>
                  </div>
                  {s.why && <p className="mt-1 text-[11px] text-muted-foreground">{s.why}</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="NOC code (5 digits)">
          <Input
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="Auto-filled or type e.g. 21231"
            inputMode="numeric"
          />
        </Field>
        <Field label="TEER category">
          <Select
            value={teer || undefined}
            onValueChange={(v) => onApply({ teer: v })}
          >
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5].map((t) => (
                <SelectItem key={t} value={String(t)}>TEER {t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Job title (as in NOC)">
          <Input
            value={title}
            onChange={(e) => {
              onApply({ title: e.target.value });
              setQuery(e.target.value);
            }}
            placeholder="Auto-filled from suggestion"
          />
        </Field>
      </div>
    </div>
  );
}

function MainApplicantTab({
  data,
  onChange,
  onPatch,
  onDocUpload,
  fieldRemarks,
}: {
  data: MainData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (f: keyof MainData, v: any) => void;
  onPatch?: (patch: Record<string, string>) => void;
  onDocUpload?: (file: File) => Promise<string>;
  fieldRemarks?: Record<string, FieldRemark>;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm font-semibold flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        Identity Documents
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DocumentUploadCard
          title="Passport"
          description="Bio-data page"
          accept=".pdf,.jpg,.jpeg,.png"
          icon={FileText}
          scanKind="passport"
          fileName={data.passportName}
          remarkKey={clientToConsultantKey("main", "passportName")}
          fieldRemarks={fieldRemarks}
          onFileChange={(n) => onChange("passportName", n)}
          onUpload={onDocUpload}
          onNewFile={() => {
            const clear = {
              passportFullName: "",
              passportNumber: "",
              dob: "",
              passportIssueDate: "",
              passportExpiry: "",
              passportNationality: "",
              passportGender: "",
            };
            if (onPatch) onPatch(clear);
            else {
              onChange("passportFullName", "");
              onChange("passportNumber", "");
              onChange("dob", "");
              onChange("passportIssueDate", "");
              onChange("passportExpiry", "");
              onChange("passportNationality", "");
              onChange("passportGender", "");
            }
          }}
          onScanPatch={onPatch}
          onScanComplete={(result) => {
            applyPassportOcrFields(result.extracted_data, (f, v) => onChange(f as keyof MainData, v));
          }}
        />
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Passport Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name (Given Names + Surname)"
            refillRemark={remarkFor(fieldRemarks, "main", "passportFullName")}>
            <Input value={data.passportFullName} onChange={(e) => onChange("passportFullName", e.target.value)} placeholder="As printed on passport" />
          </Field>
          <Field label="Passport Number"
            refillRemark={remarkFor(fieldRemarks, "main", "passportNumber")}>
            <Input value={data.passportNumber} onChange={(e) => onChange("passportNumber", e.target.value)} placeholder="e.g. AB1234567" />
          </Field>
          <Field label="Date of Birth" required
            refillRemark={remarkFor(fieldRemarks, "main", "dob")}>
            <Input type="date" value={data.dob} onChange={(e) => onChange("dob", e.target.value)} />
          </Field>
          <Field label="Date of Issue"
            refillRemark={remarkFor(fieldRemarks, "main", "passportIssueDate")}>
            <Input type="date" value={data.passportIssueDate} onChange={(e) => onChange("passportIssueDate", e.target.value)} />
          </Field>
          <Field label="Expiry Date"
            refillRemark={remarkFor(fieldRemarks, "main", "passportExpiry")}>
            <Input type="date" value={data.passportExpiry} onChange={(e) => onChange("passportExpiry", e.target.value)} />
          </Field>
          <Field label="Nationality / Country of Citizenship"
            refillRemark={remarkFor(fieldRemarks, "main", "passportNationality")}>
            <Input value={data.passportNationality} onChange={(e) => onChange("passportNationality", e.target.value)} placeholder="e.g. Pakistani" />
          </Field>
          <Field label="Sex / Gender"
            refillRemark={remarkFor(fieldRemarks, "main", "passportGender")}>
            <Select value={data.passportGender || undefined} onValueChange={(v) => onChange("passportGender", v)}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other / Unspecified</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TwoSidedDocumentCard
          title="Government ID"
          description="National ID / CNIC"
          icon={CreditCard}
          scanKind="id"
          frontFileName={data.governmentIdName}
          backFileName={data.governmentIdBackName}
          frontRemarkKey={clientToConsultantKey("main", "governmentIdName")}
          backRemarkKey={clientToConsultantKey("main", "governmentIdBackName")}
          fieldRemarks={fieldRemarks}
          onFrontChange={(n) => onChange("governmentIdName", n)}
          onBackChange={(n) => onChange("governmentIdBackName", n)}
          onUpload={onDocUpload}
          onNewFile={() => {
            onChange("nicFullName", "");
            onChange("nicNumber", "");
            onChange("nicDob", "");
            onChange("nicAddress", "");
            onChange("nicBirthPlace", "");
            onChange("nicIssueDate", "");
          }}
          onScanComplete={(result) => {
            const d = result.extracted_data;
            if (d.fullName) onChange("nicFullName", d.fullName);
            if (d.idNumber) onChange("nicNumber", d.idNumber);
            const nicDob = toInputDate(d.dob);
            if (nicDob) onChange("nicDob", nicDob);
            if (d.address) onChange("nicAddress", d.address);
            if (d.birthPlace) onChange("nicBirthPlace", d.birthPlace);
            const nicIssue = toInputDate(d.issueDate);
            if (nicIssue) onChange("nicIssueDate", nicIssue);
            if (d.gender && !data.passportGender) onChange("passportGender", mapPassportGender(d.gender) || d.gender);
            if (d.nationality && !data.passportNationality) onChange("passportNationality", d.nationality);
          }}
        />
        <TwoSidedDocumentCard
          title="Driving Licence"
          description="Current valid licence"
          icon={Car}
          scanKind="licence"
          frontFileName={data.drivingLicenseName}
          backFileName={data.drivingLicenseBackName}
          frontRemarkKey={clientToConsultantKey("main", "drivingLicenseName")}
          backRemarkKey={clientToConsultantKey("main", "drivingLicenseBackName")}
          fieldRemarks={fieldRemarks}
          onFrontChange={(n) => onChange("drivingLicenseName", n)}
          onBackChange={(n) => onChange("drivingLicenseBackName", n)}
          onUpload={onDocUpload}
          onScanComplete={(result) => {
            const d = result.extracted_data;
            if (d.fullName && !data.nicFullName) onChange("nicFullName", d.fullName);
            if (d.idNumber && !data.nicNumber) onChange("nicNumber", d.idNumber);
            const nicDob = toInputDate(d.dob);
            if (nicDob && !data.nicDob) onChange("nicDob", nicDob);
            if (d.address && !data.nicAddress) onChange("nicAddress", d.address);
            const nicIssue = toInputDate(d.issueDate);
            if (nicIssue && !data.nicIssueDate) onChange("nicIssueDate", nicIssue);
          }}
        />
      </div>
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">National ID / Driving License Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Full Name">
            <Input value={data.nicFullName} onChange={(e) => onChange("nicFullName", e.target.value)} placeholder="As on ID document" />
          </Field>
          <Field label="Document ID Number">
            <Input value={data.nicNumber} onChange={(e) => onChange("nicNumber", e.target.value)} placeholder="ID / CNIC Number" />
          </Field>
          <Field label="Date of Birth">
            <Input type="date" value={data.nicDob} onChange={(e) => onChange("nicDob", e.target.value)} />
          </Field>
          <Field label="Address on ID">
            <Input value={data.nicAddress} onChange={(e) => onChange("nicAddress", e.target.value)} placeholder="Address as on ID document" />
          </Field>
          <Field label="Birth Place">
            <Input value={data.nicBirthPlace} onChange={(e) => onChange("nicBirthPlace", e.target.value)} placeholder="e.g. Colombo" />
          </Field>
          <Field label="Date of Issue">
            <Input type="date" value={data.nicIssueDate} onChange={(e) => onChange("nicIssueDate", e.target.value)} />
          </Field>
        </div>
      </div>

      <Separator />

      <LanguagePickerField
        selected={data.languages ?? []}
        onChange={(langs) => onChange("languages", langs)}
        nameLabel="Your"
      />

      <div className="space-y-4">
        <p className="text-sm font-medium">Education Qualifications <span className="text-destructive">*</span></p>
        <div className="flex flex-wrap gap-2">
          {EDU_LEVELS.map(({ value, label }) => {
            const selected = (data.educationLevels ?? []).includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  const cur = data.educationLevels ?? [];
                  const curQuals = data.educationQuals ?? [];
                  const next = selected ? cur.filter((l) => l !== value) : [...cur, value];
                  const nextQuals = selected
                    ? curQuals.filter((q) => q.level !== value)
                    : [...curQuals, { level: value, universityName: "", courseName: "", graduationYear: "", country: "", documentName: "" }];
                  onChange("educationLevels", next);
                  onChange("educationQuals", nextQuals);
                }}
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-primary"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {(data.educationQuals ?? []).length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(data.educationQuals ?? []).map((qual, idx) => (
              <EduQualCard
                key={qual.level}
                qual={qual}
                onChange={(updated) => {
                  const next = [...(data.educationQuals ?? [])];
                  next[idx] = updated;
                  onChange("educationQuals", next);
                }}
                onUpload={onDocUpload}
              />
            ))}
          </div>
        )}
      </div>

      <Field label="Did you study full-time in Canada for at least 2 years?">
        <RadioGroup value={data.studiedInCanada} onValueChange={(v) => onChange("studiedInCanada", v)} className="flex gap-6 pt-1">
          {["yes", "no"].map((v) => (
            <div key={v} className="flex items-center space-x-2">
              <RadioGroupItem value={v} id={`canada-study-${v}`} />
              <Label htmlFor={`canada-study-${v}`} className="font-normal capitalize cursor-pointer">{v === "yes" ? "Yes" : "No"}</Label>
            </div>
          ))}
        </RadioGroup>
      </Field>

      {data.studiedInCanada === "yes" && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <p className="text-sm font-semibold">Canada Study Details</p>
          <DocumentUploadCard
            title="Study Permit / Enrollment Letter"
            description="Study permit, enrollment confirmation or transcript"
            accept=".pdf,.jpg,.jpeg,.png"
            icon={FileText}
            scanKind="study"
            fileName={data.canadaStudyDocName}
            onFileChange={(n) => onChange("canadaStudyDocName", n)}
            onUpload={onDocUpload}
            onNewFile={() => {
              onChange("canadaStudyInstitution", "");
              onChange("canadaStudyProgram", "");
              onChange("canadaStudyCity", "");
            }}
            onScanComplete={(result) => {
              const d = result.extracted_data;
              if (d.institutionName) onChange("canadaStudyInstitution", d.institutionName);
              else if (d.fullName)   onChange("canadaStudyInstitution", d.fullName);
              if (d.degreeName)      onChange("canadaStudyProgram", d.degreeName);
              const start = toInputDate(d.issueDate);
              const end = toInputDate(d.expiryDate);
              if (start) onChange("canadaStudyStart", start);
              if (end) onChange("canadaStudyEnd", end);
            }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Institution / University Name">
              <Input value={data.canadaStudyInstitution} onChange={(e) => onChange("canadaStudyInstitution", e.target.value)} placeholder="e.g. University of Toronto" />
            </Field>
            <Field label="Program / Course">
              <Input value={data.canadaStudyProgram} onChange={(e) => onChange("canadaStudyProgram", e.target.value)} placeholder="e.g. MSc Computer Science" />
            </Field>
            <Field label="City in Canada">
              <Input value={data.canadaStudyCity} onChange={(e) => onChange("canadaStudyCity", e.target.value)} placeholder="e.g. Toronto" />
            </Field>
            <Field label="Start Date">
              <Input type="date" value={data.canadaStudyStart} onChange={(e) => onChange("canadaStudyStart", e.target.value)} />
            </Field>
            <Field label="End Date">
              <Input type="date" value={data.canadaStudyEnd} onChange={(e) => onChange("canadaStudyEnd", e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
        <p className="text-sm font-semibold">Language Proficiency</p>

        <Field label="Have you taken an IELTS or CELPIP test?">
          <Select value={data.languageTest || undefined} onValueChange={(v) => onChange("languageTest", v)}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {data.languageTest === "yes" && (
          <div className="space-y-3">
            <Field label="Which English test did you take?">
              <Select value={data.languageTestType || "ielts"} onValueChange={(v) => onChange("languageTestType", v)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ielts">IELTS (General Training)</SelectItem>
                  <SelectItem value="celpip">CELPIP-G</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <DocumentUploadCard
              title={data.languageTestType === "celpip" ? "CELPIP Score Report" : "IELTS Score Report"}
              description="Upload your official test result"
              accept=".pdf,.jpg,.jpeg,.png"
              icon={FileText}
              scanKind="language"
              fileName={data.languageTestDocName}
              onFileChange={(n) => onChange("languageTestDocName", n)}
              onUpload={onDocUpload}
              onNewFile={() => onChange("scores", { listening: "", reading: "", writing: "", speaking: "" })}
              onScanComplete={(result) => {
                const d = result.extracted_data;
                const s = { ...data.scores };
                if (d.testListening) s.listening = d.testListening;
                if (d.testReading)   s.reading   = d.testReading;
                if (d.testWriting)   s.writing   = d.testWriting;
                if (d.testSpeaking)  s.speaking  = d.testSpeaking;
                onChange("scores", s);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {data.languageTestType === "celpip"
                ? "Enter CELPIP scores (1–12, maps directly to CLB)"
                : "Enter IELTS scores (0–9, step 0.5)"}
            </p>
            <ScoreInputs scores={data.scores} onChange={(f, v) => onChange("scores", { ...data.scores, [f]: v })} />
          </div>
        )}

        <Field label="Have you taken a French test (TEF Canada or TCF Canada)?">
          <Select value={data.frenchTestTaken || undefined} onValueChange={(v) => onChange("frenchTestTaken", v)}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {data.frenchTestTaken === "yes" && (
          <div className="space-y-3 rounded-lg border p-3">
            <Field label="French test type">
              <Select value={data.frenchTestType || "tef"} onValueChange={(v) => onChange("frenchTestType", v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tef">TEF Canada</SelectItem>
                  <SelectItem value="tcf">TCF Canada (CLB)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <p className="text-xs text-muted-foreground">
              {data.frenchTestType === "tcf"
                ? "Enter CLB levels (4–12) for each skill"
                : "Enter TEF Canada scores for each skill"}
            </p>
            <ScoreInputs scores={data.frenchScores} onChange={(f, v) => onChange("frenchScores", { ...data.frenchScores, [f]: v })} />
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
        <p className="text-sm font-semibold">Target Occupation (NOC 2021)</p>
        <p className="text-xs text-muted-foreground">
          Most clients do not know their NOC code. Type your job in plain words and we will suggest the official NOC 2021 code, TEER, and title.
          You can still edit the fields below. Official search:{" "}
          <a
            href="https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/find-national-occupation-code.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Canada.ca NOC finder
          </a>
          .
        </p>
        <NocSmartLookup
          code={data.intendedNocCode}
          teer={data.intendedNocTeer}
          title={data.intendedNocTitle}
          onApply={(patch) => {
            if (patch.code !== undefined) onChange("intendedNocCode", patch.code);
            if (patch.teer !== undefined) onChange("intendedNocTeer", patch.teer);
            if (patch.title !== undefined) onChange("intendedNocTitle", patch.title);
          }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Certificate of qualification in a skilled trade?">
            <RadioGroup value={data.tradeCertificate} onValueChange={(v) => onChange("tradeCertificate", v)} className="flex gap-4 pt-1">
              {["yes", "no"].map((v) => (
                <div key={v} className="flex items-center space-x-2">
                  <RadioGroupItem value={v} id={`trade-cert-${v}`} />
                  <Label htmlFor={`trade-cert-${v}`} className="font-normal capitalize cursor-pointer">{v}</Label>
                </div>
              ))}
            </RadioGroup>
          </Field>
          <Field label="Interested in Provincial Nominee Program (PNP)?">
            <RadioGroup value={data.provincialNominationInterest} onValueChange={(v) => onChange("provincialNominationInterest", v)} className="flex gap-4 pt-1">
              {["yes", "no"].map((v) => (
                <div key={v} className="flex items-center space-x-2">
                  <RadioGroupItem value={v} id={`pnp-int-${v}`} />
                  <Label htmlFor={`pnp-int-${v}`} className="font-normal capitalize cursor-pointer">{v}</Label>
                </div>
              ))}
            </RadioGroup>
          </Field>
          <Field label="Already hold a provincial nomination certificate? (+600 CRS)">
            <RadioGroup value={data.provincialNomination} onValueChange={(v) => onChange("provincialNomination", v)} className="flex gap-4 pt-1">
              {["yes", "no"].map((v) => (
                <div key={v} className="flex items-center space-x-2">
                  <RadioGroupItem value={v} id={`pnp-cert-${v}`} />
                  <Label htmlFor={`pnp-cert-${v}`} className="font-normal capitalize cursor-pointer">{v === "yes" ? "Yes — I have a nomination" : "No — not yet"}</Label>
                </div>
              ))}
            </RadioGroup>
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Total Skilled Foreign Work Experience (past 10 years)" required>
          <Select value={data.workExperience || undefined} onValueChange={(v) => onChange("workExperience", v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="less_than_1">Less than 1 year</SelectItem>
              <SelectItem value="1_to_2">1–2 years</SelectItem>
              <SelectItem value="3_or_more">3 years or more</SelectItem>
              <SelectItem value="none">No skilled foreign work experience</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Settlement Funds Available (CAD)">
          <Input
            type="number" min={0}
            value={data.settlementFunds}
            onChange={(e) => onChange("settlementFunds", e.target.value)}
            placeholder="e.g. 25000"
          />
        </Field>
      </div>

      {data.workExperience && data.workExperience !== "none" && (
        <ForeignWorkEntriesEditor
          entries={data.foreignWorkEntries ?? []}
          onChange={(next) => onChange("foreignWorkEntries", next)}
          personLabel="you"
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Field label="Do you have 1 year of authorized Canadian work experience?">
          <RadioGroup value={data.canadianWork} onValueChange={(v) => onChange("canadianWork", v)} className="flex gap-4 pt-1">
            {["yes", "no"].map((v) => (
              <div key={v} className="flex items-center space-x-2">
                <RadioGroupItem value={v} id={`can-work-${v}`} />
                <Label htmlFor={`can-work-${v}`} className="font-normal capitalize cursor-pointer">{v === "yes" ? "Yes" : "No"}</Label>
              </div>
            ))}
          </RadioGroup>
        </Field>

        <Field label="Do you have a valid Job Offer from a Canadian employer?">
          <RadioGroup value={data.jobOffer} onValueChange={(v) => onChange("jobOffer", v)} className="flex gap-4 pt-1">
            {["yes", "no"].map((v) => (
              <div key={v} className="flex items-center space-x-2">
                <RadioGroupItem value={v} id={`job-offer-${v}`} />
                <Label htmlFor={`job-offer-${v}`} className="font-normal capitalize cursor-pointer">{v === "yes" ? "Yes" : "No"}</Label>
              </div>
            ))}
          </RadioGroup>
        </Field>

        <Field label="Do you or your spouse have a sibling in Canada as PR/Citizen?">
          <RadioGroup value={data.canadianRelatives} onValueChange={(v) => onChange("canadianRelatives", v)} className="flex gap-4 pt-1">
            {["yes", "no"].map((v) => (
              <div key={v} className="flex items-center space-x-2">
                <RadioGroupItem value={v} id={`relatives-${v}`} />
                <Label htmlFor={`relatives-${v}`} className="font-normal capitalize cursor-pointer">{v === "yes" ? "Yes" : "No"}</Label>
              </div>
            ))}
          </RadioGroup>
        </Field>
      </div>

      {data.canadianWork === "yes" && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <p className="text-sm font-semibold">Canadian Work Experience Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Employer Name">
              <Input value={data.canadianWorkEmployer} onChange={(e) => onChange("canadianWorkEmployer", e.target.value)} placeholder="Company name" />
            </Field>
            <Field label="Job Title">
              <Input value={data.canadianWorkTitle} onChange={(e) => onChange("canadianWorkTitle", e.target.value)} placeholder="e.g. Software Engineer" />
            </Field>
            <Field label="City">
              <Input value={data.canadianWorkCity} onChange={(e) => onChange("canadianWorkCity", e.target.value)} placeholder="e.g. Toronto" />
            </Field>
            <Field label="Start Date">
              <Input type="date" value={data.canadianWorkStart} onChange={(e) => onChange("canadianWorkStart", e.target.value)} />
            </Field>
            <Field label="End Date">
              <Input type="date" value={data.canadianWorkEnd} onChange={(e) => onChange("canadianWorkEnd", e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {data.jobOffer === "yes" && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <p className="text-sm font-semibold">Job Offer Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Employer / Company Name">
              <Input value={data.jobOfferEmployer} onChange={(e) => onChange("jobOfferEmployer", e.target.value)} placeholder="Company name" />
            </Field>
            <Field label="Job Title / Position">
              <Input value={data.jobOfferTitle} onChange={(e) => onChange("jobOfferTitle", e.target.value)} placeholder="e.g. Software Engineer" />
            </Field>
            <Field label="NOC Code (if known)">
              <Input value={data.jobOfferNoc} onChange={(e) => onChange("jobOfferNoc", e.target.value)} placeholder="e.g. 21311" />
            </Field>
            <Field label="Province / Territory">
              <Input value={data.jobOfferProvince} onChange={(e) => onChange("jobOfferProvince", e.target.value)} placeholder="e.g. Ontario" />
            </Field>
          </div>
        </div>
      )}

      {data.canadianRelatives === "yes" && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <p className="text-sm font-semibold">Canadian Relative Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name">
              <Input value={data.relativeFullName} onChange={(e) => onChange("relativeFullName", e.target.value)} placeholder="Relative's full name" />
            </Field>
            <Field label="Relationship">
              <Input value={data.relativeRelationship} onChange={(e) => onChange("relativeRelationship", e.target.value)} placeholder="e.g. Sister, Brother" />
            </Field>
            <Field label="City in Canada">
              <Input value={data.relativeCity} onChange={(e) => onChange("relativeCity", e.target.value)} placeholder="e.g. Vancouver" />
            </Field>
            <Field label="Immigration Status">
              <Select value={data.relativeStatus || undefined} onValueChange={(v) => onChange("relativeStatus", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pr">Permanent Resident</SelectItem>
                  <SelectItem value="citizen">Canadian Citizen</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€ Tab: Spouse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SpouseTab({
  data,
  onChange,
  onPatch,
  onDocUpload,
  fieldRemarks,
}: {
  data: SpouseData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (f: keyof SpouseData, v: any) => void;
  onPatch?: (patch: Record<string, string>) => void;
  onDocUpload?: (file: File) => Promise<string>;
  fieldRemarks?: Record<string, FieldRemark>;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm font-semibold flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        {data.fullName ? `${data.fullName}'s` : "Spouse"} Identity Documents
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DocumentUploadCard
          title="Passport"
          description="Bio-data page"
          accept=".pdf,.jpg,.jpeg,.png"
          icon={FileText}
          scanKind="passport"
          fileName={data.passportName}
          remarkKey={clientToConsultantKey("spouse", "passportName")}
          fieldRemarks={fieldRemarks}
          onFileChange={(n) => onChange("passportName", n)}
          onUpload={onDocUpload}
          onNewFile={() => {
            const clear = {
              passportFullName: "",
              passportNumber: "",
              dob: "",
              passportIssueDate: "",
              passportExpiry: "",
              passportNationality: "",
              passportGender: "",
            };
            if (onPatch) onPatch(clear);
            else {
              onChange("passportFullName", "");
              onChange("passportNumber", "");
              onChange("dob", "");
              onChange("passportIssueDate", "");
              onChange("passportExpiry", "");
              onChange("passportNationality", "");
              onChange("passportGender", "");
            }
          }}
          onScanPatch={onPatch}
          onScanComplete={(result) => {
            applyPassportOcrFields(result.extracted_data, (f, v) => onChange(f as keyof SpouseData, v));
          }}
        />
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">{data.fullName ? `${data.fullName}'s` : "Spouse"} Passport Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name (Given Names + Surname)"
            refillRemark={remarkFor(fieldRemarks, "spouse", "passportFullName")}>
            <Input value={data.passportFullName} onChange={(e) => onChange("passportFullName", e.target.value)} placeholder="As printed on passport" />
          </Field>
          <Field label="Passport Number"
            refillRemark={remarkFor(fieldRemarks, "spouse", "passportNumber")}>
            <Input value={data.passportNumber} onChange={(e) => onChange("passportNumber", e.target.value)} placeholder="e.g. AB1234567" />
          </Field>
          <Field label="Date of Birth" required
            refillRemark={remarkFor(fieldRemarks, "spouse", "dob")}>
            <Input type="date" value={data.dob} onChange={(e) => onChange("dob", e.target.value)} />
          </Field>
          <Field label="Date of Issue"
            refillRemark={remarkFor(fieldRemarks, "spouse", "passportIssueDate")}>
            <Input type="date" value={data.passportIssueDate} onChange={(e) => onChange("passportIssueDate", e.target.value)} />
          </Field>
          <Field label="Expiry Date"
            refillRemark={remarkFor(fieldRemarks, "spouse", "passportExpiry")}>
            <Input type="date" value={data.passportExpiry} onChange={(e) => onChange("passportExpiry", e.target.value)} />
          </Field>
          <Field label="Nationality / Country of Citizenship"
            refillRemark={remarkFor(fieldRemarks, "spouse", "passportNationality")}>
            <Input value={data.passportNationality} onChange={(e) => onChange("passportNationality", e.target.value)} placeholder="e.g. Pakistani" />
          </Field>
          <Field label="Sex / Gender"
            refillRemark={remarkFor(fieldRemarks, "spouse", "passportGender")}>
            <Select value={data.passportGender || undefined} onValueChange={(v) => onChange("passportGender", v)}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other / Unspecified</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TwoSidedDocumentCard
          title="Government ID"
          description="National ID / CNIC"
          icon={CreditCard}
          scanKind="id"
          frontFileName={data.governmentIdName}
          backFileName={data.governmentIdBackName}
          frontRemarkKey={clientToConsultantKey("spouse", "governmentIdName")}
          backRemarkKey={clientToConsultantKey("spouse", "governmentIdBackName")}
          fieldRemarks={fieldRemarks}
          onFrontChange={(n) => onChange("governmentIdName", n)}
          onBackChange={(n) => onChange("governmentIdBackName", n)}
          onUpload={onDocUpload}
          onNewFile={() => {
            onChange("nicFullName", "");
            onChange("nicNumber", "");
            onChange("nicDob", "");
            onChange("nicAddress", "");
            onChange("nicBirthPlace", "");
            onChange("nicIssueDate", "");
          }}
          onScanComplete={(result) => {
            const d = result.extracted_data;
            if (d.fullName) onChange("nicFullName", d.fullName);
            if (d.idNumber) onChange("nicNumber", d.idNumber);
            const nicDob = toInputDate(d.dob);
            if (nicDob) onChange("nicDob", nicDob);
            if (d.address) onChange("nicAddress", d.address);
            if (d.birthPlace) onChange("nicBirthPlace", d.birthPlace);
            const nicIssue = toInputDate(d.issueDate);
            if (nicIssue) onChange("nicIssueDate", nicIssue);
            if (d.gender && !data.passportGender) onChange("passportGender", mapPassportGender(d.gender) || d.gender);
            if (d.nationality && !data.passportNationality) onChange("passportNationality", d.nationality);
          }}
        />
        <TwoSidedDocumentCard
          title="Driving Licence"
          description="Current valid licence"
          icon={Car}
          scanKind="licence"
          frontFileName={data.drivingLicenseName}
          backFileName={data.drivingLicenseBackName}
          frontRemarkKey={clientToConsultantKey("spouse", "drivingLicenseName")}
          backRemarkKey={clientToConsultantKey("spouse", "drivingLicenseBackName")}
          fieldRemarks={fieldRemarks}
          onFrontChange={(n) => onChange("drivingLicenseName", n)}
          onBackChange={(n) => onChange("drivingLicenseBackName", n)}
          onUpload={onDocUpload}
          onScanComplete={(result) => {
            const d = result.extracted_data;
            if (d.fullName && !data.nicFullName) onChange("nicFullName", d.fullName);
            if (d.idNumber && !data.nicNumber) onChange("nicNumber", d.idNumber);
            const nicDob = toInputDate(d.dob);
            if (nicDob && !data.nicDob) onChange("nicDob", nicDob);
            if (d.address && !data.nicAddress) onChange("nicAddress", d.address);
            const nicIssue = toInputDate(d.issueDate);
            if (nicIssue && !data.nicIssueDate) onChange("nicIssueDate", nicIssue);
          }}
        />
      </div>
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{data.fullName ? `${data.fullName}'s` : "Spouse"} ID & Driving License Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Full Name">
            <Input value={data.nicFullName} onChange={(e) => onChange("nicFullName", e.target.value)} placeholder="As on ID document" />
          </Field>
          <Field label="Document ID Number">
            <Input value={data.nicNumber} onChange={(e) => onChange("nicNumber", e.target.value)} placeholder="ID / CNIC Number" />
          </Field>
          <Field label="Date of Birth">
            <Input type="date" value={data.nicDob} onChange={(e) => onChange("nicDob", e.target.value)} />
          </Field>
          <Field label="Address on ID">
            <Input value={data.nicAddress} onChange={(e) => onChange("nicAddress", e.target.value)} placeholder="Address as on ID document" />
          </Field>
          <Field label="Birth Place">
            <Input value={data.nicBirthPlace} onChange={(e) => onChange("nicBirthPlace", e.target.value)} placeholder="e.g. Colombo" />
          </Field>
          <Field label="Date of Issue">
            <Input type="date" value={data.nicIssueDate} onChange={(e) => onChange("nicIssueDate", e.target.value)} />
          </Field>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Spouse Full Name" required>
          <Input value={data.fullName} onChange={(e) => onChange("fullName", e.target.value)} placeholder="As in Passport" />
        </Field>
      </div>

      <LanguagePickerField
        selected={data.languages ?? []}
        onChange={(langs) => onChange("languages", langs)}
        nameLabel={data.fullName ? `${data.fullName}'s` : "Spouse"}
      />

      <div className="space-y-4">
        <p className="text-sm font-medium">{data.fullName ? `${data.fullName}'s` : "Spouse"} Education Qualifications <span className="text-destructive">*</span></p>
        <div className="flex flex-wrap gap-2">
          {EDU_LEVELS.map(({ value, label }) => {
            const selected = (data.educationLevels ?? []).includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  const cur = data.educationLevels ?? [];
                  const curQuals = data.educationQuals ?? [];
                  const next = selected ? cur.filter((l) => l !== value) : [...cur, value];
                  const nextQuals = selected
                    ? curQuals.filter((q) => q.level !== value)
                    : [...curQuals, { level: value, universityName: "", courseName: "", graduationYear: "", country: "", documentName: "" }];
                  onChange("educationLevels", next);
                  onChange("educationQuals", nextQuals);
                }}
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-primary"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {(data.educationQuals ?? []).length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(data.educationQuals ?? []).map((qual, idx) => (
              <EduQualCard
                key={qual.level}
                qual={qual}
                onChange={(updated) => {
                  const next = [...(data.educationQuals ?? [])];
                  next[idx] = updated;
                  onChange("educationQuals", next);
                }}
                onUpload={onDocUpload}
              />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
        <p className="text-sm font-semibold">{data.fullName ? `${data.fullName}'s` : "Spouse"} Language Proficiency</p>

        <Field label="Has your spouse taken an IELTS or CELPIP test?">
          <Select value={data.languageTest || undefined} onValueChange={(v) => onChange("languageTest", v)}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {data.languageTest === "yes" && (
          <div className="space-y-3">
            <Field label="Which English test did your spouse take?">
              <Select value={data.languageTestType || "ielts"} onValueChange={(v) => onChange("languageTestType", v)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ielts">IELTS (General Training)</SelectItem>
                  <SelectItem value="celpip">CELPIP-G</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <DocumentUploadCard
              title={data.languageTestType === "celpip" ? "CELPIP Score Report" : "IELTS Score Report"}
              description="Upload your spouse's official test result"
              accept=".pdf,.jpg,.jpeg,.png"
              icon={FileText}
              scanKind="language"
              fileName={data.languageTestDocName}
              onFileChange={(n) => onChange("languageTestDocName", n)}
              onUpload={onDocUpload}
              onNewFile={() => onChange("scores", { listening: "", reading: "", writing: "", speaking: "" })}
              onScanComplete={(result) => {
                const d = result.extracted_data;
                const s = { ...data.scores };
                if (d.testListening) s.listening = d.testListening;
                if (d.testReading)   s.reading   = d.testReading;
                if (d.testWriting)   s.writing   = d.testWriting;
                if (d.testSpeaking)  s.speaking  = d.testSpeaking;
                onChange("scores", s);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {data.languageTestType === "celpip"
                ? "Enter CELPIP scores (1–12)"
                : "Enter IELTS scores (0–9, step 0.5)"}
            </p>
            <ScoreInputs scores={data.scores} onChange={(f, v) => onChange("scores", { ...data.scores, [f]: v })} />
          </div>
        )}

        <Field label="Has your spouse taken a French test (TEF Canada or TCF Canada)?">
          <Select value={data.frenchTestTaken || undefined} onValueChange={(v) => onChange("frenchTestTaken", v)}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {data.frenchTestTaken === "yes" && (
          <div className="space-y-3 rounded-lg border p-3">
            <Field label="French test type">
              <Select value={data.frenchTestType || "tef"} onValueChange={(v) => onChange("frenchTestType", v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tef">TEF Canada</SelectItem>
                  <SelectItem value="tcf">TCF Canada (CLB)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <ScoreInputs scores={data.frenchScores} onChange={(f, v) => onChange("frenchScores", { ...data.frenchScores, [f]: v })} />
          </div>
        )}
      </div>

      <Field label="Spouse's total skilled foreign work experience (past 10 years)">
        <Select value={data.workExperience || undefined} onValueChange={(v) => onChange("workExperience", v)}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="less_than_1">Less than 1 year</SelectItem>
            <SelectItem value="1_to_2">1–2 years</SelectItem>
            <SelectItem value="3_or_more">3 years or more</SelectItem>
            <SelectItem value="none">No skilled foreign work experience</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {data.workExperience && data.workExperience !== "none" && (
        <ForeignWorkEntriesEditor
          entries={data.foreignWorkEntries ?? []}
          onChange={(next) => onChange("foreignWorkEntries", next)}
          personLabel={data.fullName ? data.fullName : "your spouse"}
        />
      )}

      <Field label="Does your spouse have 1 year of authorized Canadian work experience?">
        <RadioGroup value={data.canadianWork} onValueChange={(v) => onChange("canadianWork", v)} className="flex gap-6 pt-1">
          {["yes", "no"].map((v) => (
            <div key={v} className="flex items-center space-x-2">
              <RadioGroupItem value={v} id={`spouse-work-${v}`} />
              <Label htmlFor={`spouse-work-${v}`} className="font-normal capitalize cursor-pointer">{v === "yes" ? "Yes" : "No"}</Label>
            </div>
          ))}
        </RadioGroup>
      </Field>

      {data.canadianWork === "yes" && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <p className="text-sm font-semibold">{data.fullName ? `${data.fullName}'s` : "Spouse"} Canadian Work Experience</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Employer Name">
              <Input value={data.canadianWorkEmployer} onChange={(e) => onChange("canadianWorkEmployer", e.target.value)} placeholder="Company name" />
            </Field>
            <Field label="Job Title">
              <Input value={data.canadianWorkTitle} onChange={(e) => onChange("canadianWorkTitle", e.target.value)} placeholder="e.g. Software Engineer" />
            </Field>
            <Field label="City">
              <Input value={data.canadianWorkCity} onChange={(e) => onChange("canadianWorkCity", e.target.value)} placeholder="e.g. Toronto" />
            </Field>
            <Field label="Start Date">
              <Input type="date" value={data.canadianWorkStart} onChange={(e) => onChange("canadianWorkStart", e.target.value)} />
            </Field>
            <Field label="End Date">
              <Input type="date" value={data.canadianWorkEnd} onChange={(e) => onChange("canadianWorkEnd", e.target.value)} />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€ Tab: Children â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ChildrenTab({
  children,
  onChange,
  onDocUpload,
}: {
  children: ChildData[];
  onChange: (i: number, f: keyof ChildData, v: string) => void;
  onDocUpload?: (file: File) => Promise<string>;
}) {
  return (
    <div className="space-y-4">
      {children.map((child, i) => (
        <Card key={i}>
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge variant="secondary" className="h-6 w-6 flex items-center justify-center rounded-full p-0 text-xs">
                {i + 1}
              </Badge>
              Child {i + 1}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Identity Documents</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <DocumentUploadCard
                title="Passport"
                description="Bio-data page"
                accept=".pdf,.jpg,.jpeg,.png"
                icon={FileText}
                scanKind="passport"
                fileName={child.passportName}
                onFileChange={(n) => onChange(i, "passportName", n)}
                onUpload={onDocUpload}
                onNewFile={() => {
                  onChange(i, "passportFullName", "");
                  onChange(i, "passportNumber", "");
                  onChange(i, "dob", "");
                  onChange(i, "passportIssueDate", "");
                  onChange(i, "passportExpiry", "");
                  onChange(i, "passportNationality", "");
                  onChange(i, "passportGender", "");
                }}
                onScanPatch={(patch) => {
                  Object.entries(patch).forEach(([f, v]) => onChange(i, f as keyof ChildData, v));
                }}
                onScanComplete={(result) => {
                  applyPassportOcrFields(result.extracted_data, (f, v) => onChange(i, f as keyof ChildData, v));
                }}
              />
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Passport Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name (Given Names + Surname)">
                  <Input value={child.passportFullName} onChange={(e) => onChange(i, "passportFullName", e.target.value)} placeholder="As printed on passport" />
                </Field>
                <Field label="Passport Number">
                  <Input value={child.passportNumber} onChange={(e) => onChange(i, "passportNumber", e.target.value)} placeholder="e.g. AB1234567" />
                </Field>
                <Field label="Date of Birth">
                  <Input type="date" value={child.dob} onChange={(e) => onChange(i, "dob", e.target.value)} />
                </Field>
                <Field label="Date of Issue">
                  <Input type="date" value={child.passportIssueDate} onChange={(e) => onChange(i, "passportIssueDate", e.target.value)} />
                </Field>
                <Field label="Expiry Date">
                  <Input type="date" value={child.passportExpiry} onChange={(e) => onChange(i, "passportExpiry", e.target.value)} />
                </Field>
                <Field label="Nationality / Country of Citizenship">
                  <Input value={child.passportNationality} onChange={(e) => onChange(i, "passportNationality", e.target.value)} placeholder="e.g. Pakistani" />
                </Field>
                <Field label="Sex / Gender">
                  <Select value={child.passportGender || undefined} onValueChange={(v) => onChange(i, "passportGender", v)}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other / Unspecified</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
              <TwoSidedDocumentCard
                title="Government ID"
                description="National ID / CNIC"
                icon={CreditCard}
                scanKind="id"
                frontFileName={child.governmentIdName}
                backFileName={child.governmentIdBackName}
                onFrontChange={(n) => onChange(i, "governmentIdName", n)}
                onBackChange={(n) => onChange(i, "governmentIdBackName", n)}
                onUpload={onDocUpload}
                onNewFile={() => {
                  onChange(i, "nicFullName", "");
                  onChange(i, "nicNumber", "");
                  onChange(i, "nicDob", "");
                  onChange(i, "nicAddress", "");
                  onChange(i, "nicBirthPlace", "");
                  onChange(i, "nicIssueDate", "");
                }}
                onScanComplete={(result) => {
                  const d = result.extracted_data;
                  if (d.fullName)    onChange(i, "nicFullName", d.fullName);
                  if (d.idNumber)    onChange(i, "nicNumber", d.idNumber);
                  if (d.dob)         onChange(i, "nicDob", d.dob);
                  if (d.address)     onChange(i, "nicAddress", d.address);
                  if (d.birthPlace)  onChange(i, "nicBirthPlace", d.birthPlace);
                  if (d.issueDate)   onChange(i, "nicIssueDate", d.issueDate);
                  if (d.gender && !child.passportGender) onChange(i, "passportGender", d.gender);
                  if (d.nationality && !child.passportNationality) onChange(i, "passportNationality", d.nationality);
                }}
              />
              <TwoSidedDocumentCard
                title="Driving Licence"
                description="If applicable"
                icon={Car}
                scanKind="licence"
                frontFileName={child.drivingLicenseName}
                backFileName={child.drivingLicenseBackName}
                onFrontChange={(n) => onChange(i, "drivingLicenseName", n)}
                onBackChange={(n) => onChange(i, "drivingLicenseBackName", n)}
                onUpload={onDocUpload}
                onScanComplete={(result) => {
                  const d = result.extracted_data;
                  if (d.fullName && !child.nicFullName) onChange(i, "nicFullName", d.fullName);
                  if (d.idNumber && !child.nicNumber) onChange(i, "nicNumber", d.idNumber);
                  const nicDob = toInputDate(d.dob);
                  if (nicDob && !child.nicDob) onChange(i, "nicDob", nicDob);
                }}
              />
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">National ID / Driving License Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Full Name">
                  <Input value={child.nicFullName} onChange={(e) => onChange(i, "nicFullName", e.target.value)} placeholder="As on ID document" />
                </Field>
                <Field label="Document ID Number">
                  <Input value={child.nicNumber} onChange={(e) => onChange(i, "nicNumber", e.target.value)} placeholder="ID / CNIC Number" />
                </Field>
                <Field label="Date of Birth">
                  <Input type="date" value={child.nicDob} onChange={(e) => onChange(i, "nicDob", e.target.value)} />
                </Field>
                <Field label="Address on ID">
                  <Input value={child.nicAddress} onChange={(e) => onChange(i, "nicAddress", e.target.value)} placeholder="Address as on ID document" />
                </Field>
                <Field label="Birth Place">
                  <Input value={child.nicBirthPlace} onChange={(e) => onChange(i, "nicBirthPlace", e.target.value)} placeholder="e.g. Colombo" />
                </Field>
                <Field label="Date of Issue">
                  <Input type="date" value={child.nicIssueDate} onChange={(e) => onChange(i, "nicIssueDate", e.target.value)} />
                </Field>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name">
                <Input value={child.name} onChange={(e) => onChange(i, "name", e.target.value)} placeholder="Child's name" />
              </Field>
              <Field label="Current Education Level">
                <Select value={child.educationLevel || undefined} onValueChange={(v) => onChange(i, "educationLevel", v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary School</SelectItem>
                    <SelectItem value="secondary">Secondary School</SelectItem>
                    <SelectItem value="none">None / Pre-school</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// â”€â”€ Tab: Accompanying Persons

function AccompanyingPersonsTab({
  persons,
  onChange,
  onDocUpload,
}: {
  persons: AccompanyingPerson[];
  onChange: (i: number, f: keyof AccompanyingPerson, v: string) => void;
  onDocUpload?: (file: File) => Promise<string>;
}) {
  if (persons.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No accompanying persons added.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {persons.map((person, i) => (
        <Card key={i}>
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge variant="secondary" className="h-6 w-6 flex items-center justify-center rounded-full p-0 text-xs">
                {i + 1}
              </Badge>
              {person.relationship && RELATIONSHIP_LABELS[person.relationship]
                ? RELATIONSHIP_LABELS[person.relationship]
                : `Person ${i + 1}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identity Documents</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <DocumentUploadCard
                title="Passport"
                description="Bio-data page"
                accept=".pdf,.jpg,.jpeg,.png"
                icon={FileText}
                scanKind="passport"
                fileName={person.passportName}
                onFileChange={(n) => onChange(i, "passportName", n)}
                onUpload={onDocUpload}
                onNewFile={() => {
                  onChange(i, "passportFullName", "");
                  onChange(i, "passportNumber", "");
                  onChange(i, "dob", "");
                  onChange(i, "passportIssueDate", "");
                  onChange(i, "passportExpiry", "");
                  onChange(i, "passportNationality", "");
                  onChange(i, "passportGender", "");
                }}
                onScanPatch={(patch) => {
                  Object.entries(patch).forEach(([f, v]) => onChange(i, f as keyof AccompanyingPerson, v));
                }}
                onScanComplete={(result) => {
                  applyPassportOcrFields(result.extracted_data, (f, v) => onChange(i, f as keyof AccompanyingPerson, v));
                }}
              />
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Passport Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name (Given Names + Surname)">
                  <Input value={person.passportFullName} onChange={(e) => onChange(i, "passportFullName", e.target.value)} placeholder="As printed on passport" />
                </Field>
                <Field label="Passport Number">
                  <Input value={person.passportNumber} onChange={(e) => onChange(i, "passportNumber", e.target.value)} placeholder="e.g. AB1234567" />
                </Field>
                <Field label="Date of Birth" required>
                  <Input type="date" value={person.dob} onChange={(e) => onChange(i, "dob", e.target.value)} />
                </Field>
                <Field label="Date of Issue">
                  <Input type="date" value={person.passportIssueDate} onChange={(e) => onChange(i, "passportIssueDate", e.target.value)} />
                </Field>
                <Field label="Expiry Date">
                  <Input type="date" value={person.passportExpiry} onChange={(e) => onChange(i, "passportExpiry", e.target.value)} />
                </Field>
                <Field label="Nationality / Country of Citizenship">
                  <Input value={person.passportNationality} onChange={(e) => onChange(i, "passportNationality", e.target.value)} placeholder="e.g. Pakistani" />
                </Field>
                <Field label="Sex / Gender">
                  <Select value={person.passportGender || undefined} onValueChange={(v) => onChange(i, "passportGender", v)}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other / Unspecified</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <TwoSidedDocumentCard
                title="Government ID"
                description="National ID / CNIC"
                icon={CreditCard}
                scanKind="id"
                frontFileName={person.governmentIdName}
                backFileName={person.governmentIdBackName}
                onFrontChange={(n) => onChange(i, "governmentIdName", n)}
                onBackChange={(n) => onChange(i, "governmentIdBackName", n)}
                onUpload={onDocUpload}
                onNewFile={() => {
                  onChange(i, "nicFullName", "");
                  onChange(i, "nicNumber", "");
                  onChange(i, "nicDob", "");
                  onChange(i, "nicAddress", "");
                  onChange(i, "nicBirthPlace", "");
                  onChange(i, "nicIssueDate", "");
                }}
                onScanComplete={(result) => {
                  const d = result.extracted_data;
                  if (d.fullName)    onChange(i, "nicFullName", d.fullName);
                  if (d.idNumber)    onChange(i, "nicNumber", d.idNumber);
                  if (d.dob)         onChange(i, "nicDob", d.dob);
                  if (d.address)     onChange(i, "nicAddress", d.address);
                  if (d.birthPlace)  onChange(i, "nicBirthPlace", d.birthPlace);
                  if (d.issueDate)   onChange(i, "nicIssueDate", d.issueDate);
                  if (d.gender && !person.passportGender) onChange(i, "passportGender", d.gender);
                  if (d.nationality && !person.passportNationality) onChange(i, "passportNationality", d.nationality);
                }}
              />
              <TwoSidedDocumentCard
                title="Driving Licence"
                description="If applicable"
                icon={Car}
                scanKind="licence"
                frontFileName={person.drivingLicenseName}
                backFileName={person.drivingLicenseBackName}
                onFrontChange={(n) => onChange(i, "drivingLicenseName", n)}
                onBackChange={(n) => onChange(i, "drivingLicenseBackName", n)}
                onUpload={onDocUpload}
                onScanComplete={(result) => {
                  const d = result.extracted_data;
                  if (d.fullName && !person.nicFullName) onChange(i, "nicFullName", d.fullName);
                  if (d.idNumber && !person.nicNumber) onChange(i, "nicNumber", d.idNumber);
                  const nicDob = toInputDate(d.dob);
                  if (nicDob && !person.nicDob) onChange(i, "nicDob", nicDob);
                }}
              />
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">National ID / Driving License Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Full Name">
                  <Input value={person.nicFullName} onChange={(e) => onChange(i, "nicFullName", e.target.value)} placeholder="As on ID document" />
                </Field>
                <Field label="Document ID Number">
                  <Input value={person.nicNumber} onChange={(e) => onChange(i, "nicNumber", e.target.value)} placeholder="ID / CNIC Number" />
                </Field>
                <Field label="Date of Birth">
                  <Input type="date" value={person.nicDob} onChange={(e) => onChange(i, "nicDob", e.target.value)} />
                </Field>
                <Field label="Address on ID">
                  <Input value={person.nicAddress} onChange={(e) => onChange(i, "nicAddress", e.target.value)} placeholder="Address as on ID document" />
                </Field>
                <Field label="Birth Place">
                  <Input value={person.nicBirthPlace} onChange={(e) => onChange(i, "nicBirthPlace", e.target.value)} placeholder="e.g. Colombo" />
                </Field>
                <Field label="Date of Issue">
                  <Input type="date" value={person.nicIssueDate} onChange={(e) => onChange(i, "nicIssueDate", e.target.value)} />
                </Field>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <Input
                  value={person.fullName}
                  onChange={(e) => onChange(i, "fullName", e.target.value)}
                  placeholder="As in Passport"
                />
              </Field>
            </div>
            <Field label="Relationship to Main Applicant" required>
              <Select
                value={person.relationship || undefined}
                onValueChange={(v) => onChange(i, "relationship", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my_parent">My Parent</SelectItem>
                  <SelectItem value="spouse_parent">Spouse&apos;s Parent</SelectItem>
                  <SelectItem value="sibling">My Sibling</SelectItem>
                  <SelectItem value="in_law">In-Law</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {person.relationship === "other" && (
              <Field label="Please specify relationship">
                <Input
                  value={person.otherRelationship}
                  onChange={(e) => onChange(i, "otherRelationship", e.target.value)}
                  placeholder="e.g. Uncle, Grandparent…"
                />
              </Field>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// â”€â”€ Document upload card

// â”€â”€ Two-sided document upload (front + back) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ─── ChildSingleTab ─────────────────────────────────────────────────────────

function ChildSingleTab({
  data,
  onChange,
  onPatch,
  onDocUpload,
  fieldRemarks,
  childIndex,
}: {
  data: ChildData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (f: keyof ChildData, v: any) => void;
  onPatch?: (patch: Record<string, string>) => void;
  onDocUpload?: (file: File) => Promise<string>;
  fieldRemarks?: Record<string, FieldRemark>;
  childIndex: number;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {data.name ? `${data.name}'s` : "Child's"} Identity Documents
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <DocumentUploadCard
          title="Passport"
          description="Bio-data page"
          accept=".pdf,.jpg,.jpeg,.png"
          icon={FileText}
          scanKind="passport"
          fileName={data.passportName}
          remarkKey={clientToConsultantKey("child", "passportName", childIndex)}
          fieldRemarks={fieldRemarks}
          onFileChange={(n) => onChange("passportName", n)}
          onUpload={onDocUpload}
          onNewFile={() => {
            const clear = {
              passportFullName: "", passportNumber: "", dob: "",
              passportIssueDate: "", passportExpiry: "",
              passportNationality: "", passportGender: "",
            };
            if (onPatch) onPatch(clear);
            else {
              onChange("passportFullName", ""); onChange("passportNumber", "");
              onChange("dob", ""); onChange("passportIssueDate", ""); onChange("passportExpiry", "");
              onChange("passportNationality", ""); onChange("passportGender", "");
            }
          }}
          onScanPatch={onPatch}
          onScanComplete={(result) => {
            applyPassportOcrFields(result.extracted_data, (f, v) => onChange(f as keyof ChildData, v));
          }}
        />
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">{data.name ? `${data.name}'s` : "Child's"} Passport Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name (Given Names + Surname)"
            refillRemark={remarkFor(fieldRemarks, "child", "passportFullName", childIndex)}>
            <Input value={data.passportFullName} onChange={(e) => onChange("passportFullName", e.target.value)} placeholder="As printed on passport" />
          </Field>
          <Field label="Passport Number"
            refillRemark={remarkFor(fieldRemarks, "child", "passportNumber", childIndex)}>
            <Input value={data.passportNumber} onChange={(e) => onChange("passportNumber", e.target.value)} placeholder="e.g. AB1234567" />
          </Field>
          <Field label="Date of Birth"
            refillRemark={remarkFor(fieldRemarks, "child", "dob", childIndex)}>
            <Input type="date" value={data.dob} onChange={(e) => onChange("dob", e.target.value)} />
          </Field>
          <Field label="Date of Issue"
            refillRemark={remarkFor(fieldRemarks, "child", "passportIssueDate", childIndex)}>
            <Input type="date" value={data.passportIssueDate} onChange={(e) => onChange("passportIssueDate", e.target.value)} />
          </Field>
          <Field label="Expiry Date"
            refillRemark={remarkFor(fieldRemarks, "child", "passportExpiry", childIndex)}>
            <Input type="date" value={data.passportExpiry} onChange={(e) => onChange("passportExpiry", e.target.value)} />
          </Field>
          <Field label="Nationality / Country of Citizenship"
            refillRemark={remarkFor(fieldRemarks, "child", "passportNationality", childIndex)}>
            <Input value={data.passportNationality} onChange={(e) => onChange("passportNationality", e.target.value)} placeholder="e.g. Pakistani" />
          </Field>
          <Field label="Sex / Gender"
            refillRemark={remarkFor(fieldRemarks, "child", "passportGender", childIndex)}>
            <Select value={data.passportGender || undefined} onValueChange={(v) => onChange("passportGender", v)}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other / Unspecified</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TwoSidedDocumentCard
          title="Government ID" description="National ID / CNIC" icon={CreditCard} scanKind="id"
          frontFileName={data.governmentIdName} backFileName={data.governmentIdBackName}
          frontRemarkKey={clientToConsultantKey("child", "governmentIdName", childIndex)}
          backRemarkKey={clientToConsultantKey("child", "governmentIdBackName", childIndex)}
          fieldRemarks={fieldRemarks}
          onFrontChange={(n) => onChange("governmentIdName", n)}
          onBackChange={(n) => onChange("governmentIdBackName", n)}
          onUpload={onDocUpload}
          onNewFile={() => {
            onChange("nicFullName", ""); onChange("nicNumber", ""); onChange("nicDob", "");
            onChange("nicAddress", ""); onChange("nicBirthPlace", ""); onChange("nicIssueDate", "");
          }}
          onScanComplete={(result) => {
            const d = result.extracted_data;
            if (d.fullName)   onChange("nicFullName", d.fullName);
            if (d.idNumber)   onChange("nicNumber", d.idNumber);
            if (d.dob)        onChange("nicDob", d.dob);
            if (d.address)    onChange("nicAddress", d.address);
            if (d.birthPlace) onChange("nicBirthPlace", d.birthPlace);
            if (d.issueDate)  onChange("nicIssueDate", d.issueDate);
            if (d.gender && !data.passportGender) onChange("passportGender", d.gender);
            if (d.nationality && !data.passportNationality) onChange("passportNationality", d.nationality);
          }}
        />
        <TwoSidedDocumentCard
          title="Driving Licence" description="If applicable" icon={Car} scanKind="licence"
          frontFileName={data.drivingLicenseName} backFileName={data.drivingLicenseBackName}
          frontRemarkKey={clientToConsultantKey("child", "drivingLicenseName", childIndex)}
          backRemarkKey={clientToConsultantKey("child", "drivingLicenseBackName", childIndex)}
          fieldRemarks={fieldRemarks}
          onFrontChange={(n) => onChange("drivingLicenseName", n)}
          onBackChange={(n) => onChange("drivingLicenseBackName", n)}
          onUpload={onDocUpload}
          onScanComplete={(result) => {
            const d = result.extracted_data;
            if (d.fullName && !data.nicFullName) onChange("nicFullName", d.fullName);
            if (d.idNumber && !data.nicNumber) onChange("nicNumber", d.idNumber);
            const nicDob = toInputDate(d.dob);
            if (nicDob && !data.nicDob) onChange("nicDob", nicDob);
          }}
        />
      </div>
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{data.name ? `${data.name}'s` : "Child's"} ID & Driving License Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Full Name"><Input value={data.nicFullName} onChange={(e) => onChange("nicFullName", e.target.value)} placeholder="As on ID document" /></Field>
          <Field label="Document ID Number"><Input value={data.nicNumber} onChange={(e) => onChange("nicNumber", e.target.value)} placeholder="ID / CNIC Number" /></Field>
          <Field label="Date of Birth"><Input type="date" value={data.nicDob} onChange={(e) => onChange("nicDob", e.target.value)} /></Field>
          <Field label="Address on ID"><Input value={data.nicAddress} onChange={(e) => onChange("nicAddress", e.target.value)} placeholder="Address as on ID document" /></Field>
          <Field label="Birth Place"><Input value={data.nicBirthPlace} onChange={(e) => onChange("nicBirthPlace", e.target.value)} placeholder="e.g. Colombo" /></Field>
          <Field label="Date of Issue"><Input type="date" value={data.nicIssueDate} onChange={(e) => onChange("nicIssueDate", e.target.value)} /></Field>
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full Name"
          refillRemark={remarkFor(fieldRemarks, "child", "name", childIndex)}>
          <Input value={data.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Child's full name" />
        </Field>
        <Field label="Current Education Level"
          refillRemark={remarkFor(fieldRemarks, "child", "educationLevel", childIndex)}>
          <Select value={data.educationLevel || undefined} onValueChange={(v) => onChange("educationLevel", v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="primary">Primary School</SelectItem>
              <SelectItem value="secondary">Secondary School</SelectItem>
              <SelectItem value="none">None / Pre-school</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <LanguagePickerField
        selected={data.languages ?? []}
        onChange={(langs) => onChange("languages", langs)}
        nameLabel={data.name ? `${data.name}'s` : "Child's"}
      />
    </div>
  );
}

// ─── AccompanyingPersonSingleTab ─────────────────────────────────────────────

function AccompanyingPersonSingleTab({
  data,
  onChange,
  onPatch,
  onDocUpload,
  fieldRemarks,
  personIndex,
}: {
  data: AccompanyingPerson;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (f: keyof AccompanyingPerson, v: any) => void;
  onPatch?: (patch: Record<string, string>) => void;
  onDocUpload?: (file: File) => Promise<string>;
  fieldRemarks?: Record<string, FieldRemark>;
  personIndex: number;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {data.fullName ? `${data.fullName}'s` : "This Person's"} Identity Documents
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <DocumentUploadCard
          title="Passport"
          description="Bio-data page"
          accept=".pdf,.jpg,.jpeg,.png"
          icon={FileText}
          scanKind="passport"
          fileName={data.passportName}
          remarkKey={clientToConsultantKey("accompanying", "passportName", personIndex)}
          fieldRemarks={fieldRemarks}
          onFileChange={(n) => onChange("passportName", n)}
          onUpload={onDocUpload}
          onNewFile={() => {
            const clear = {
              passportFullName: "", passportNumber: "", dob: "",
              passportIssueDate: "", passportExpiry: "",
              passportNationality: "", passportGender: "",
            };
            if (onPatch) onPatch(clear);
            else {
              onChange("passportFullName", ""); onChange("passportNumber", "");
              onChange("dob", ""); onChange("passportIssueDate", ""); onChange("passportExpiry", "");
              onChange("passportNationality", ""); onChange("passportGender", "");
            }
          }}
          onScanPatch={onPatch}
          onScanComplete={(result) => {
            applyPassportOcrFields(result.extracted_data, (f, v) => onChange(f as keyof AccompanyingPerson, v));
          }}
        />
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">{data.fullName ? `${data.fullName}'s` : "This Person's"} Passport Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name (Given Names + Surname)"
            refillRemark={remarkFor(fieldRemarks, "accompanying", "passportFullName", personIndex)}>
            <Input value={data.passportFullName} onChange={(e) => onChange("passportFullName", e.target.value)} placeholder="As printed on passport" />
          </Field>
          <Field label="Passport Number"
            refillRemark={remarkFor(fieldRemarks, "accompanying", "passportNumber", personIndex)}>
            <Input value={data.passportNumber} onChange={(e) => onChange("passportNumber", e.target.value)} placeholder="e.g. AB1234567" />
          </Field>
          <Field label="Date of Birth" required
            refillRemark={remarkFor(fieldRemarks, "accompanying", "dob", personIndex)}>
            <Input type="date" value={data.dob} onChange={(e) => onChange("dob", e.target.value)} />
          </Field>
          <Field label="Date of Issue"
            refillRemark={remarkFor(fieldRemarks, "accompanying", "passportIssueDate", personIndex)}>
            <Input type="date" value={data.passportIssueDate} onChange={(e) => onChange("passportIssueDate", e.target.value)} />
          </Field>
          <Field label="Expiry Date"
            refillRemark={remarkFor(fieldRemarks, "accompanying", "passportExpiry", personIndex)}>
            <Input type="date" value={data.passportExpiry} onChange={(e) => onChange("passportExpiry", e.target.value)} />
          </Field>
          <Field label="Nationality / Country of Citizenship"
            refillRemark={remarkFor(fieldRemarks, "accompanying", "passportNationality", personIndex)}>
            <Input value={data.passportNationality} onChange={(e) => onChange("passportNationality", e.target.value)} placeholder="e.g. Pakistani" />
          </Field>
          <Field label="Sex / Gender"
            refillRemark={remarkFor(fieldRemarks, "accompanying", "passportGender", personIndex)}>
            <Select value={data.passportGender || undefined} onValueChange={(v) => onChange("passportGender", v)}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other / Unspecified</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TwoSidedDocumentCard
          title="Government ID" description="National ID / CNIC" icon={CreditCard} scanKind="id"
          frontFileName={data.governmentIdName} backFileName={data.governmentIdBackName}
          frontRemarkKey={clientToConsultantKey("accompanying", "governmentIdName", personIndex)}
          backRemarkKey={clientToConsultantKey("accompanying", "governmentIdBackName", personIndex)}
          fieldRemarks={fieldRemarks}
          onFrontChange={(n) => onChange("governmentIdName", n)}
          onBackChange={(n) => onChange("governmentIdBackName", n)}
          onUpload={onDocUpload}
          onNewFile={() => {
            onChange("nicFullName", ""); onChange("nicNumber", ""); onChange("nicDob", "");
            onChange("nicAddress", ""); onChange("nicBirthPlace", ""); onChange("nicIssueDate", "");
          }}
          onScanComplete={(result) => {
            const d = result.extracted_data;
            if (d.fullName)   onChange("nicFullName", d.fullName);
            if (d.idNumber)   onChange("nicNumber", d.idNumber);
            if (d.dob)        onChange("nicDob", d.dob);
            if (d.address)    onChange("nicAddress", d.address);
            if (d.birthPlace) onChange("nicBirthPlace", d.birthPlace);
            if (d.issueDate)  onChange("nicIssueDate", d.issueDate);
            if (d.gender && !data.passportGender) onChange("passportGender", d.gender);
            if (d.nationality && !data.passportNationality) onChange("passportNationality", d.nationality);
          }}
        />
        <TwoSidedDocumentCard
          title="Driving Licence" description="If applicable" icon={Car} scanKind="licence"
          frontFileName={data.drivingLicenseName} backFileName={data.drivingLicenseBackName}
          frontRemarkKey={clientToConsultantKey("accompanying", "drivingLicenseName", personIndex)}
          backRemarkKey={clientToConsultantKey("accompanying", "drivingLicenseBackName", personIndex)}
          fieldRemarks={fieldRemarks}
          onFrontChange={(n) => onChange("drivingLicenseName", n)}
          onBackChange={(n) => onChange("drivingLicenseBackName", n)}
          onUpload={onDocUpload}
          onScanComplete={(result) => {
            const d = result.extracted_data;
            if (d.fullName && !data.nicFullName) onChange("nicFullName", d.fullName);
            if (d.idNumber && !data.nicNumber) onChange("nicNumber", d.idNumber);
            const nicDob = toInputDate(d.dob);
            if (nicDob && !data.nicDob) onChange("nicDob", nicDob);
          }}
        />
      </div>
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{data.fullName ? `${data.fullName}'s` : "This Person's"} ID & Driving License Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Full Name"><Input value={data.nicFullName} onChange={(e) => onChange("nicFullName", e.target.value)} placeholder="As on ID document" /></Field>
          <Field label="Document ID Number"><Input value={data.nicNumber} onChange={(e) => onChange("nicNumber", e.target.value)} placeholder="ID / CNIC Number" /></Field>
          <Field label="Date of Birth"><Input type="date" value={data.nicDob} onChange={(e) => onChange("nicDob", e.target.value)} /></Field>
          <Field label="Address on ID"><Input value={data.nicAddress} onChange={(e) => onChange("nicAddress", e.target.value)} placeholder="Address as on ID document" /></Field>
          <Field label="Birth Place"><Input value={data.nicBirthPlace} onChange={(e) => onChange("nicBirthPlace", e.target.value)} placeholder="e.g. Colombo" /></Field>
          <Field label="Date of Issue"><Input type="date" value={data.nicIssueDate} onChange={(e) => onChange("nicIssueDate", e.target.value)} /></Field>
        </div>
      </div>
      <Separator />
      <div className="space-y-3">
        <Field label="Full Name" required
          refillRemark={remarkFor(fieldRemarks, "accompanying", "fullName", personIndex)}>
          <Input value={data.fullName} onChange={(e) => onChange("fullName", e.target.value)} placeholder="As in Passport" />
        </Field>
        <Field label="Relationship to Main Applicant" required
          refillRemark={remarkFor(fieldRemarks, "accompanying", "relationship", personIndex)}>
          <Select value={data.relationship || undefined} onValueChange={(v) => onChange("relationship", v)}>
            <SelectTrigger><SelectValue placeholder="Select relationship…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="my_parent">My Parent</SelectItem>
              <SelectItem value="spouse_parent">Spouse&apos;s Parent</SelectItem>
              <SelectItem value="sibling">My Sibling</SelectItem>
              <SelectItem value="in_law">In-Law</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {data.relationship === "other" && (
          <Field label="Please specify relationship">
            <Input value={data.otherRelationship} onChange={(e) => onChange("otherRelationship", e.target.value)} placeholder="e.g. Uncle, Grandparent…" />
          </Field>
        )}
      </div>

      <LanguagePickerField
        selected={data.languages ?? []}
        onChange={(langs) => onChange("languages", langs)}
        nameLabel={data.fullName ? `${data.fullName}'s` : "This Person's"}
      />
    </div>
  );
}

function TwoSidedDocumentCard({
  title, description, icon: Icon,
  frontFileName, backFileName,
  frontRemarkKey, backRemarkKey, fieldRemarks,
  scanKind,
  onFrontChange, onBackChange,
  onUpload,
  onScanComplete,
  onNewFile,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  frontFileName: string;
  backFileName: string;
  frontRemarkKey?: string;
  backRemarkKey?: string;
  fieldRemarks?: Record<string, FieldRemark>;
  scanKind?: ScanKind;
  onFrontChange: (n: string) => void;
  onBackChange: (n: string) => void;
  onUpload?: (file: File) => Promise<string>;
  onScanComplete?: (result: OcrResult) => void;
  onNewFile?: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description} Â· Upload both sides</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DocumentUploadCard
          title="Front Side"
          description=""
          accept=".pdf,.jpg,.jpeg,.png"
          icon={Icon}
          scanKind={scanKind}
          fileName={frontFileName}
          remarkKey={frontRemarkKey}
          fieldRemarks={fieldRemarks}
          onFileChange={onFrontChange}
          onUpload={onUpload}
          onScanComplete={onScanComplete}
          onNewFile={onNewFile}
        />
        <DocumentUploadCard
          title="Back Side"
          description=""
          accept=".pdf,.jpg,.jpeg,.png"
          icon={Icon}
          scanKind={scanKind}
          fileName={backFileName}
          remarkKey={backRemarkKey}
          fieldRemarks={fieldRemarks}
          onFileChange={onBackChange}
          onUpload={onUpload}
          onScanComplete={onScanComplete}
          onNewFile={onNewFile}
        />
      </div>
    </div>
  );
}

function DocumentUploadCard({
  title, description, accept,
  icon: Icon,
  fileName,
  remarkKey,
  fieldRemarks,
  scanKind,
  onFileChange,
  onUpload,
  onScanComplete,
  onScanPatch,
  onNewFile,
}: {
  title: string;
  description: string;
  accept: string;
  icon: React.ComponentType<{ className?: string }>;
  fileName: string;
  remarkKey?: string;
  fieldRemarks?: Record<string, FieldRemark>;
  scanKind?: ScanKind;
  onFileChange: (name: string) => void;
  onUpload?: (file: File) => Promise<string>;
  onScanComplete?: (result: OcrResult) => void;
  /** Preferred: apply all passport fields in one state update */
  onScanPatch?: (patch: Record<string, string>) => void;
  onNewFile?: () => void;
}) {
  const inputRef                      = useRef<HTMLInputElement>(null);
  const cameraInputRef              = useRef<HTMLInputElement>(null);
  const isMobile                      = useIsMobile();
  const acceptsImages                 = /jpe?g|png|image/i.test(accept);
  const [uploading, setUploading]     = useState(false);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | "other">("other");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [scanResult, setScanResult]   = useState<OcrResult | null>(null);
  const [scanError, setScanError]     = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [scanning, setScanning]         = useState(false);
  const [loadingStored, setLoadingStored] = useState(false);
  const loadedStoredPathRef             = useRef<string | null>(null);
  const refillRemark = remarkKey ? getPendingRemark(fieldRemarks ?? {}, remarkKey) : undefined;

  function processScanResult(result: OcrResult) {
    const useful = scanKind === "passport"
      ? hasUsefulPassportFields(result.extracted_data)
      : hasUsefulExtractedFields(result.extracted_data);
    if (scanKind) {
      const mismatch = scanKindMismatch(scanKind, result.document_type);
      if (mismatch && !useful) {
        setScanError(mismatch);
        setScanResult(result);
        return;
      }
      if (mismatch && useful) {
        setScanError(`${mismatch} Some fields were still filled — please verify them.`);
      } else {
        setScanError(result.message ?? null);
      }
    } else {
      setScanError(result.message ?? null);
    }
    setScanResult(result);
    if (useful) {
      if (scanKind === "passport" && onScanPatch) {
        applyPassportOcrPatch(result.extracted_data, onScanPatch);
      } else {
        onScanComplete?.(result);
      }
    } else if (!scanKind) {
      onScanComplete?.(result);
    }
  }

  // S3 paths look like "client-document/2026/05/name.pdf" — show only basename
  const displayName = fileName
    ? (fileName.includes("/") ? fileName.split("/").pop()! : fileName)
    : uploadedFile?.name ?? "";

  // Load preview for previously uploaded S3 documents on page reload
  useEffect(() => {
    if (!isStoredDocumentPath(fileName)) {
      loadedStoredPathRef.current = null;
      return;
    }
    if (uploadedFile) return;
    if (loadedStoredPathRef.current === fileName && previewUrl) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadStoredPreview() {
      const token = getToken();
      if (!token) return;
      setLoadingStored(true);
      try {
        const res = await fetch(
          `${API}/questionnaire/document/stream?path=${encodeURIComponent(fileName)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const mediaType = inferStoredDocumentMediaType(fileName, blob.type);
        objectUrl = URL.createObjectURL(blob);
        loadedStoredPathRef.current = fileName;
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
        setPreviewType(mediaType);
      } finally {
        if (!cancelled) setLoadingStored(false);
      }
    }

    void loadStoredPreview();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName, uploadedFile]);

  async function processSelectedFile(file: File) {
    // Clear previously scanned/filled fields before processing the new image
    onNewFile?.();

    // Build local preview URL
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    loadedStoredPathRef.current = null;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPreviewType(
      file.type.startsWith("image/")
        ? "image"
        : file.type === "application/pdf"
        ? "pdf"
        : inferStoredDocumentMediaType(file.name, file.type),
    );

    setUploadedFile(file);
    if (onUpload) {
      setUploading(true);
      try {
        const path = await onUpload(file);
        onFileChange(path);
      } catch {
        // keep local filename in state; autosave will store it
      } finally {
        setUploading(false);
      }
    }
    // Auto-analyse immediately after upload
    setScanning(true);
    setScanResult(null);
    setScanError(null);
    try {
      const { result, error } = await scanDocumentFile(file, scanKind);
      if (error) {
        setScanError(error);
        return;
      }
      if (result) processScanResult(result);
    } finally {
      setScanning(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processSelectedFile(file);
    e.target.value = "";
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function openCamera() {
    cameraInputRef.current?.click();
  }

  function handleRemove() {
    if (inputRef.current) inputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    loadedStoredPathRef.current = null;
    setPreviewUrl(null);
    setPreviewType("other");
    setPreviewOpen(false);
    setScanResult(null);
    setScanError(null);
    setUploadedFile(null);
    onFileChange("");
  }

  async function handleScan() {
    if (!uploadedFile) return;
    setScanning(true);
    setScanResult(null);
    setScanError(null);
    try {
      const { result, error } = await scanDocumentFile(uploadedFile, scanKind);
      if (error) {
        setScanError(error);
        return;
      }
      if (result) processScanResult(result);
    } finally {
      setScanning(false);
    }
  }

  return (
    <>
      <div className={cn("rounded-xl border bg-card p-5 space-y-4", refillRemark && "border-amber-300 bg-amber-50/30")}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {refillRemark && (
          <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-xs text-amber-900">
            <MessageSquare className="mt-0.5 size-3.5 shrink-0" />
            <span><span className="font-semibold">Consultant note:</span> {refillRemark.remark}</span>
          </p>
        )}

        {/* Drop zone */}
        <div
          className={cn(
            "rounded-lg border-2 border-dashed transition-colors relative",
            uploading || loadingStored
              ? "border-primary/40 bg-primary/5"
              : displayName
              ? "border-green-400 bg-green-50"
              : "border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer",
          )}
          onClick={() => {
            if (uploading || loadingStored || displayName) return;
            if (isMobile && acceptsImages) return;
            openFilePicker();
          }}
        >
          {uploading || loadingStored ? (
            <div className="flex items-center justify-center gap-2 text-sm text-primary p-5">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{loadingStored ? "Loading document…" : "Uploading…"}</span>
            </div>
          ) : displayName ? (
            /* â”€â”€ Uploaded: large thumbnail with eye-icon overlay â”€â”€ */
            <div className="relative">
              {/* Thumbnail / preview area */}
              <div
                className="w-full h-44 overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setPreviewOpen(true); }}
              >
                {previewUrl && previewType === "image" ? (
                  <img
                    src={previewUrl}
                    alt="preview"
                    className="h-full w-full object-cover"
                  />
                ) : previewUrl && previewType === "pdf" ? (
                  <div className="flex flex-col items-center gap-2 select-none">
                    <FileText className="h-16 w-16 text-red-400" />
                    <span className="text-xs font-medium text-red-400">PDF Document</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 select-none">
                    <FileText className="h-16 w-16 text-muted-foreground/40" />
                    <span className="text-xs text-muted-foreground">Document</span>
                  </div>
                )}
              </div>

              {/* Eye icon — top-right corner overlay */}
              <button
                type="button"
                className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-green-300 shadow-md hover:bg-white hover:shadow-lg transition-all text-green-700 text-xs font-medium"
                onClick={(e) => { e.stopPropagation(); setPreviewOpen(true); }}
                title="View full document"
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </button>

              {/* Uploaded badge — bottom-left corner */}
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-green-600/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full shadow">
                <CheckCircle2 className="h-3 w-3" />
                Uploaded
              </div>

              {/* OCR scan badge — bottom-right corner */}
              {scanResult && (
                <div className={cn(
                  "absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full shadow backdrop-blur-sm",
                  scanResult.status === "success"
                    ? "bg-blue-600/90 text-white"
                    : "bg-yellow-500/90 text-white",
                )}>
                  {scanResult.status === "success" ? "ðŸ” Scanned" : "âš  Low quality"}
                </div>
              )}
              {/* Scanning animation overlay */}
              {scanning && (
                <>
                  <style>{`@keyframes wtc-scan-beam{0%{top:0}50%{top:calc(100% - 3px)}100%{top:0}}`}</style>
                  <div className="absolute inset-0 rounded-lg overflow-hidden z-30 bg-primary/10">
                    <div
                      className="absolute left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_10px_3px_rgba(59,130,246,0.65)]"
                      style={{ animation: "wtc-scan-beam 1.6s ease-in-out infinite" }}
                    />
                    <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-primary" />
                    <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-primary" />
                    <div className="absolute bottom-8 left-2 w-5 h-5 border-b-2 border-l-2 border-primary" />
                    <div className="absolute bottom-8 right-2 w-5 h-5 border-b-2 border-r-2 border-primary" />
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap shadow-lg">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Scanning document…
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3 p-5 text-center">
              <Upload className="mx-auto h-7 w-7 text-muted-foreground/40" />
              {isMobile && acceptsImages ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground">Upload a document photo</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-10 w-full"
                      onClick={(e) => { e.stopPropagation(); openCamera(); }}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Take photo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 w-full"
                      onClick={(e) => { e.stopPropagation(); openFilePicker(); }}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Choose file or PDF
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60">JPG, PNG, or PDF — up to 10 MB · PDF page 1 is scanned automatically</p>
                </>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Click to upload</p>
                  <p className="text-[11px] text-muted-foreground/60">PDF, JPG, PNG — up to 10 MB · PDFs are scanned too</p>
                </div>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFileSelect}
          />
          {acceptsImages && (
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
          )}
        </div>

        {/* OCR extracted data summary — shown for both success and partial_success */}
        {scanError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <p className="text-[10px] font-semibold text-red-700">{scanError}</p>
          </div>
        )}

        {scanResult?.authenticity && scanResult.authenticity.verdict !== "unknown" && (() => {
          const tone = authenticityTone(scanResult.authenticity.verdict);
          const AuthIcon = ["suspicious", "likely_fake"].includes(scanResult.authenticity.verdict)
            ? ShieldAlert
            : ShieldCheck;
          return (
            <div className={cn("rounded-lg border px-3 py-2 space-y-1", tone.className)}>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
                <AuthIcon className="h-3.5 w-3.5 shrink-0" />
                {tone.label}
                {typeof scanResult.authenticity.score === "number" && scanResult.authenticity.score > 0 && (
                  <span className="font-normal normal-case opacity-80">
                    · score {Math.round(scanResult.authenticity.score * 100)}%
                  </span>
                )}
              </p>
              {scanResult.authenticity.summary && (
                <p className="text-[10px] leading-snug opacity-90">{scanResult.authenticity.summary}</p>
              )}
              {(scanResult.authenticity.flags?.length ?? 0) > 0 && (
                <p className="text-[10px] opacity-80">
                  Flags: {scanResult.authenticity.flags!.join(", ")}
                </p>
              )}
              <p className="text-[9px] opacity-70">
                Assistive AI screen only — not a legal authenticity decision. Consultant should verify originals.
              </p>
            </div>
          );
        })()}

        {scanResult && (() => {
          const d = scanResult.extracted_data;
          const fields: Array<[string, string | undefined]> = [
            ["Name",        d.fullName || undefined],
            ["DOB",         d.dob || undefined],
            ["Issue",       d.issueDate || undefined],
            ["ID / No.",    d.passportNumber || d.idNumber || undefined],
            ["Expiry",      d.expiryDate || undefined],
            ["Nationality", d.nationality || undefined],
            ["Institution", d.institutionName || undefined],
            ["Program",     d.degreeName || undefined],
            ["Grad year",   d.graduationYear || undefined],
            ["Country",     d.country || undefined],
            ["Listening",   d.testListening || undefined],
            ["Reading",     d.testReading || undefined],
            ["Writing",     d.testWriting || undefined],
            ["Speaking",    d.testSpeaking || undefined],
          ].filter(([, v]) => !!v) as Array<[string, string]>;

          const isPartial = scanResult.status === "partial_success";
          if (fields.length === 0) {
            return (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2">
                <p className="text-[10px] font-semibold text-yellow-700">
                  Could not extract data. Please use a clearer, well-lit photo.
                </p>
              </div>
            );
          }
          return (
            <div className={`rounded-lg px-3 py-2 space-y-1 border ${isPartial ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-200"}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${isPartial ? "text-yellow-700" : "text-blue-600"}`}>
                {isPartial ? "Partial extraction — please verify" : "Auto-extracted data"}
              </p>
              <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2">
                {fields.map(([label, value]) => (
                  <div key={label} className="flex items-baseline gap-1 min-w-0">
                    <span className="text-[10px] text-muted-foreground shrink-0">{label}:</span>
                    <span className="text-[10px] font-medium text-foreground truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Remove / rescan */}
        {displayName && !uploading && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              disabled={scanning || !uploadedFile}
              onClick={handleScan}
            >
              {scanning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Re-scan document
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-7 px-2"
              onClick={handleRemove}
            >
              Remove file
            </Button>
          </div>
        )}
      </div>

      {/* Full-document preview modal */}
      {previewOpen && previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="min-w-0 truncate text-sm font-semibold">{displayName}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 flex-1 text-xs sm:flex-none sm:h-7"
                  onClick={handleRemove}
                >
                  Remove &amp; Re-upload
                </Button>
                <button
                  type="button"
                  className="p-1.5 rounded hover:bg-muted transition-colors"
                  onClick={() => setPreviewOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center p-4">
              {previewType === "image" ? (
                <img
                  src={previewUrl}
                  alt={displayName}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow"
                />
              ) : previewType === "pdf" ? (
                <iframe
                  src={previewUrl}
                  title={displayName}
                  className="w-full rounded border bg-white"
                  style={{ height: "70vh" }}
                />
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Preview not available for this file type</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">{displayName}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Step 3 form ────────────────────────────────────────────────────────────────

const EDU_LEVELS: { value: string; label: string }[] = [
  { value: "phd",       label: "PhD / Doctorate" },
  { value: "masters",   label: "Master’s Degree" },
  { value: "bachelors", label: "Bachelor’s Degree" },
  { value: "diploma",   label: "Diploma (2 yrs)" },
  { value: "al",        label: "A/L" },
  { value: "other",     label: "Other" },
];

const EDU_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  EDU_LEVELS.map(({ value, label }) => [value, label])
);

const LANGUAGES: { value: string; label: string }[] = [
  { value: "english", label: "English" },
  { value: "french",  label: "French 🇫🇷" },
  { value: "sinhala", label: "Sinhala" },
  { value: "tamil",   label: "Tamil" },
  { value: "hindi",   label: "Hindi" },
  { value: "other",   label: "Other" },
];

const PREDEFINED_LANG_VALUES = LANGUAGES.map((l) => l.value);

function LanguagePickerField({
  selected,
  onChange,
  nameLabel,
}: {
  selected: string[];
  onChange: (langs: string[]) => void;
  nameLabel: string;
}) {
  const [customInput, setCustomInput] = useState("");
  const custom = selected.filter((l) => !PREDEFINED_LANG_VALUES.includes(l));

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((l) => l !== value));
    else onChange([...selected, value]);
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed || selected.map((l) => l.toLowerCase()).includes(trimmed.toLowerCase())) return;
    onChange([...selected, trimmed]);
    setCustomInput("");
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <p className="text-sm font-semibold">{nameLabel} Languages</p>
      <p className="text-xs text-muted-foreground">
        Select all languages they can communicate in. Can&apos;t find yours? Type it below.
      </p>
      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map(({ value, label }) => {
          const sel = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggle(value)}
              className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                sel
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:border-primary"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {custom.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {custom.map((l) => (
            <span key={l} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-primary text-primary-foreground">
              {l}
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x !== l))}
                className="hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="Add another language…"
          className="h-9 text-sm"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="px-4 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
      {selected.includes("french") && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <Star className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">French is a major advantage!</span> French speakers earn bonus CRS points in Express Entry and qualify for dedicated Francophone immigration streams — significantly boosting chances for Canadian permanent residency.
          </p>
        </div>
      )}
    </div>
  );
}

function EduQualCard({
  qual,
  onChange,
  onUpload,
}: {
  qual: EduQualification;
  onChange: (updated: EduQualification) => void;
  onUpload?: (file: File) => Promise<string>;
}) {
  const label = EDU_LEVEL_LABELS[qual.level] ?? qual.level;
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <p className="text-sm font-semibold flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        {label}
      </p>
      <DocumentUploadCard
        title="Upload Certificate"
        description="Degree, diploma or transcript"
        accept=".pdf,.jpg,.jpeg,.png"
        icon={Upload}
        scanKind="education"
        fileName={qual.documentName}
        onFileChange={(n) => onChange({ ...qual, documentName: n })}
        onUpload={onUpload}
        onNewFile={() => onChange({ ...qual, universityName: "", courseName: "", graduationYear: "", country: "" })}
        onScanComplete={(result) => {
          const d = result.extracted_data;
          const updated: EduQualification = { ...qual };
          if (d.institutionName)     updated.universityName = d.institutionName;
          else if (d.fullName)       updated.universityName = d.fullName;
          if (d.degreeName)          updated.courseName     = d.degreeName;
          if (d.graduationYear)      updated.graduationYear = d.graduationYear;
          else if (d.issueDate)      updated.graduationYear = d.issueDate.slice(0, 4);
          if (d.country)             updated.country        = d.country;
          else if (d.nationality)    updated.country        = d.nationality;
          onChange(updated);
        }}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="University / Institution Name">
          <Input
            value={qual.universityName}
            onChange={(e) => onChange({ ...qual, universityName: e.target.value })}
            placeholder="e.g. University of Colombo"
          />
        </Field>
        <Field label="Degree / Course Name">
          <Input
            value={qual.courseName}
            onChange={(e) => onChange({ ...qual, courseName: e.target.value })}
            placeholder="e.g. BSc Computer Science"
          />
        </Field>
        <Field label="Year of Graduation">
          <Input
            type="number" min={1970} max={2030}
            value={qual.graduationYear}
            onChange={(e) => onChange({ ...qual, graduationYear: e.target.value })}
            placeholder="e.g. 2020"
          />
        </Field>
        <Field label="Country">
          <Input
            value={qual.country}
            onChange={(e) => onChange({ ...qual, country: e.target.value })}
            placeholder="e.g. Sri Lanka"
          />
        </Field>
      </div>
    </div>
  );
}

// ─── Review Step helpers ──────────────────────────────────────────────────────
function ReviewCard({
  title, subtitle, icon: Icon, onEdit, children,
}: {
  title: string; subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  onEdit: () => void; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold leading-tight">{title}</CardTitle>
            {subtitle && <CardDescription className="text-xs mt-0.5">{subtitle}</CardDescription>}
          </div>
          <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0 h-7 text-xs px-3">
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
          {children}
        </dl>
      </CardContent>
    </Card>
  );
}

function RR({ label, v }: { label: string; v?: string | null }) {
  if (!v?.trim()) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{v}</dd>
    </div>
  );
}

function ReviewStep({
  data, onEdit1, onEdit2,
}: {
  data: FormData;
  onEdit1: () => void;
  onEdit2: (tabIndex: number) => void;
}) {
  const LANG_LABEL: Record<string, string> = Object.fromEntries(
    LANGUAGES.map(({ value, label }) => [value, label])
  );
  const fmtLangs = (langs?: string[]) =>
    langs?.length ? langs.map((l) => LANG_LABEL[l] ?? l).join(", ") : null;
  const fmtEdus = (levels?: string[]) =>
    levels?.length ? levels.map((l) => EDU_LEVEL_LABELS[l] ?? l).join(", ") : null;
  const fmtScore = (s?: ScoreSet) => {
    if (!s) return null;
    const p = [
      s.listening && `L:${s.listening}`, s.reading  && `R:${s.reading}`,
      s.writing   && `W:${s.writing}`,   s.speaking && `S:${s.speaking}`,
    ].filter(Boolean);
    return p.length ? p.join("  ") : null;
  };
  const yesno = (v?: string) => v === "yes" ? "Yes" : v === "no" ? "No" : null;
  const docs = (...names: (string | undefined)[]) => {
    const f = names.filter((n): n is string => !!n?.trim());
    return f.length ? f.join(", ") : null;
  };

  // Mirror the tabs array logic to get correct tab indices
  let t = 0;
  const mainIdx   = t++;
  const spouseIdx = data.married === "yes" ? t++ : -1;
  const childStart = t; t += data.children.length;
  const accStart  = t;

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="rounded-xl bg-green-50 border border-green-200 p-5 text-center space-y-1.5">
        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
        <p className="text-base font-semibold text-green-800">Almost there! Review your information</p>
        <p className="text-sm text-green-600">
          Check all details below. Click <strong>Edit</strong> on any section to go back and fix mistakes, then submit.
        </p>
      </div>

      {/* ── General Info ── */}
      <ReviewCard title="General Info" icon={User} onEdit={onEdit1}>
        <RR label="Full Name"           v={data.fullName} />
        <RR label="Email"               v={data.email} />
        <RR label="WhatsApp"            v={data.whatsapp} />
        {data.visaType ? <RR label="Visa Type" v={data.visaType} /> : null}
        <RR label="Marital Status"      v={data.married === "yes" ? "Married" : data.married === "no" ? "Not Married" : null} />
        <RR label="Dependent Children"  v={data.dependentChildren !== "0" ? data.dependentChildren : null} />
        {data.married === "yes" && <RR label="Spouse Name"          v={data.spouse.fullName} />}
        {data.hasAccompanying === "yes" && <RR label="Accompanying Persons" v={data.accompanyingCount} />}
      </ReviewCard>

      {/* ── Main Applicant ── */}
      <ReviewCard
        title={data.fullName || "Main Applicant"} subtitle="Main Applicant"
        icon={User} onEdit={() => onEdit2(mainIdx)}
      >
        <RR label="Date of Birth"     v={data.main.dob} />
        <RR label="Languages"         v={fmtLangs(data.main.languages)} />
        <RR label="Education"         v={fmtEdus(data.main.educationLevels)} />
        <RR label="Language Test"     v={data.main.languageTest} />
        <RR label="English Test Type" v={data.main.languageTestType?.toUpperCase()} />
        <RR label="Test Scores"       v={fmtScore(data.main.scores)} />
        <RR label="French Test"       v={yesno(data.main.frenchTestTaken)} />
        <RR label="NOC Code"          v={data.main.intendedNocCode} />
        <RR label="Trade Certificate" v={yesno(data.main.tradeCertificate)} />
        <RR label="PNP Interest"      v={yesno(data.main.provincialNominationInterest)} />
        <RR label="Prov. Nomination"  v={yesno(data.main.provincialNomination)} />
        <RR label="Work Experience"   v={data.main.workExperience} />
        {(data.main.foreignWorkEntries ?? []).length > 0 && (
          <RR
            label="Foreign jobs"
            v={(data.main.foreignWorkEntries ?? [])
              .map((j, i) => {
                const when = j.currentlyWorking === "yes"
                  ? `${j.startDate || "?"} – present`
                  : `${j.startDate || "?"} – ${j.endDate || "?"}`;
                return `${i + 1}. ${j.jobTitle || "Role"} @ ${j.companyName || "Company"} (${j.country || "?"}, ${when})`;
              })
              .join(" · ")}
          />
        )}
        <RR label="Canadian Work"     v={yesno(data.main.canadianWork)} />
        {data.main.canadianWork === "yes" && <>
          <RR label="Employer"        v={data.main.canadianWorkEmployer} />
          <RR label="Job Title"       v={data.main.canadianWorkTitle} />
        </>}
        <RR label="Job Offer"         v={yesno(data.main.jobOffer)} />
        {data.main.jobOffer === "yes" && <RR label="Offer Employer" v={data.main.jobOfferEmployer} />}
        <RR label="Settlement Funds"  v={data.main.settlementFunds} />
        <RR label="Studied in Canada" v={yesno(data.main.studiedInCanada)} />
        {data.main.studiedInCanada === "yes" && <RR label="Institution" v={data.main.canadaStudyInstitution} />}
        <RR label="Passport Name"     v={data.main.passportFullName} />
        <RR label="Passport No."      v={data.main.passportNumber} />
        <RR label="Passport Issue"    v={data.main.passportIssueDate} />
        <RR label="Passport Expiry"   v={data.main.passportExpiry} />
        <RR label="Nationality"       v={data.main.passportNationality} />
        <RR label="NIC Number"        v={data.main.nicNumber} />
        <RR label="Uploaded Docs"     v={docs(data.main.passportName, data.main.governmentIdName, data.main.drivingLicenseName, data.main.languageTestDocName)} />
      </ReviewCard>

      {/* ── Spouse ── */}
      {data.married === "yes" && spouseIdx !== -1 && (
        <ReviewCard
          title={data.spouse.fullName || "Spouse"} subtitle="Spouse"
          icon={Users} onEdit={() => onEdit2(spouseIdx)}
        >
          <RR label="Date of Birth"  v={data.spouse.dob} />
          <RR label="Languages"      v={fmtLangs(data.spouse.languages)} />
          <RR label="Education"      v={fmtEdus(data.spouse.educationLevels)} />
          <RR label="Language Test"  v={data.spouse.languageTest} />
          <RR label="English Type"   v={data.spouse.languageTestType?.toUpperCase()} />
          <RR label="Test Scores"    v={fmtScore(data.spouse.scores)} />
          <RR label="French Test"    v={yesno(data.spouse.frenchTestTaken)} />
          <RR label="Foreign Work"   v={data.spouse.workExperience} />
          {(data.spouse.foreignWorkEntries ?? []).length > 0 && (
            <RR
              label="Foreign jobs"
              v={(data.spouse.foreignWorkEntries ?? [])
                .map((j, i) => {
                  const when = j.currentlyWorking === "yes"
                    ? `${j.startDate || "?"} – present`
                    : `${j.startDate || "?"} – ${j.endDate || "?"}`;
                  return `${i + 1}. ${j.jobTitle || "Role"} @ ${j.companyName || "Company"} (${j.country || "?"}, ${when})`;
                })
                .join(" · ")}
            />
          )}
          <RR label="Canadian Work"  v={yesno(data.spouse.canadianWork)} />
          {data.spouse.canadianWork === "yes" && <>
            <RR label="Employer"     v={data.spouse.canadianWorkEmployer} />
            <RR label="Job Title"    v={data.spouse.canadianWorkTitle} />
          </>}
          <RR label="Passport Name"  v={data.spouse.passportFullName} />
          <RR label="Passport No."   v={data.spouse.passportNumber} />
          <RR label="NIC Number"     v={data.spouse.nicNumber} />
          <RR label="Uploaded Docs"  v={docs(data.spouse.passportName, data.spouse.governmentIdName, data.spouse.drivingLicenseName)} />
        </ReviewCard>
      )}

      {/* ── Children ── */}
      {data.children.map((child, i) => (
        <ReviewCard
          key={i} title={child.name || `Child ${i + 1}`} subtitle={`Child ${i + 1}`}
          icon={Baby} onEdit={() => onEdit2(childStart + i)}
        >
          <RR label="Date of Birth"   v={child.dob} />
          <RR label="Languages"       v={fmtLangs(child.languages)} />
          <RR label="Education Level" v={EDU_LEVEL_LABELS[child.educationLevel] ?? child.educationLevel ?? null} />
          <RR label="Passport Name"   v={child.passportFullName} />
          <RR label="Passport No."    v={child.passportNumber} />
          <RR label="NIC Number"      v={child.nicNumber} />
          <RR label="Uploaded Docs"   v={docs(child.passportName, child.governmentIdName, child.drivingLicenseName)} />
        </ReviewCard>
      ))}

      {/* ── Accompanying ── */}
      {data.accompanying.map((person, i) => (
        <ReviewCard
          key={i} title={person.fullName || `Person ${i + 1}`}
          subtitle={person.relationship === "other" ? person.otherRelationship : person.relationship}
          icon={UserPlus} onEdit={() => onEdit2(accStart + i)}
        >
          <RR label="Date of Birth"  v={person.dob} />
          <RR label="Languages"      v={fmtLangs(person.languages)} />
          <RR label="Relationship"   v={person.relationship === "other" ? person.otherRelationship : person.relationship} />
          <RR label="Passport Name"  v={person.passportFullName} />
          <RR label="Passport No."   v={person.passportNumber} />
          <RR label="NIC Number"     v={person.nicNumber} />
          <RR label="Uploaded Docs"  v={docs(person.passportName, person.governmentIdName, person.drivingLicenseName)} />
        </ReviewCard>
      ))}
    </div>
  );
}

function YesNo({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="flex gap-6 pt-1">
      {["yes", "no"].map((v) => (
        <div key={v} className="flex items-center space-x-2">
          <RadioGroupItem value={v} id={`${id}-${v}`} />
          <Label htmlFor={`${id}-${v}`} className="font-normal cursor-pointer">{v === "yes" ? "Yes" : "No"}</Label>
        </div>
      ))}
    </RadioGroup>
  );
}

function PathwayDataChecklist({ data }: { data: FormData }) {
  const checks: { ok: boolean; label: string }[] = [
    { ok: !!data.main.dob, label: "Main applicant — date of birth" },
    { ok: (data.main.educationLevels ?? []).length > 0, label: "Main applicant — education level" },
    { ok: data.main.languageTest === "yes" && Object.values(data.main.scores).some(Boolean), label: "Main applicant — English test scores" },
    { ok: !!data.main.workExperience, label: "Main applicant — foreign work experience" },
    {
      ok: data.main.workExperience === "none"
        || data.main.workExperience === ""
        || (data.main.foreignWorkEntries ?? []).some((j) => j.companyName && j.jobTitle && j.startDate),
      label: "Main applicant — foreign job details (company & dates)",
    },
    { ok: !!data.main.intendedNocCode, label: "Main applicant — target NOC code" },
    ...(data.married === "yes"
      ? [
          { ok: !!data.spouse.dob, label: "Spouse — date of birth" },
          { ok: (data.spouse.educationLevels ?? []).length > 0 || !!data.spouseEduLevel, label: "Spouse — education" },
          { ok: data.spouse.languageTest === "yes" && Object.values(data.spouse.scores).some(Boolean), label: "Spouse — English test scores" },
        ]
      : []),
  ];
  const done = checks.filter(c => c.ok).length;

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-blue-900">Pathway & CRS data (from Step 2)</h3>
        <p className="text-xs text-blue-800/90 mt-1 leading-relaxed">
          Education, language tests, work history, NOC, and nomination details are collected in Step 2 under
          <strong> Main Applicant</strong>{data.married === "yes" ? " and Spouse" : ""} tabs.
          Complete any missing items there — your consultant uses that data for pathway recommendations.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={done === checks.length ? "default" : "outline"} className="text-xs">
          {done}/{checks.length} key items captured
        </Badge>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {checks.map(c => (
          <li key={c.label} className={cn(
            "flex items-center gap-2 text-xs rounded-md px-2 py-1.5",
            c.ok ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"
          )}>
            {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
            {c.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Step3Form({
  data,
  onChange,
  onUpload,
}: {
  data: FormData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (f: keyof FormData, v: any) => void;
  onUpload?: (file: File) => Promise<string>;
}) {
  return (
    <div className="space-y-8">

      <PathwayDataChecklist data={data} />

      <Separator />

      {/* 1. Financial Capacity */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-primary uppercase tracking-wide">
          1. Financial Capacity (Proof of Funds)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Available Settlement Funds (approx.)">
            <Select value={data.fundsLkrRange || undefined} onValueChange={(v) => onChange("fundsLkrRange", v)}>
              <SelectTrigger><SelectValue placeholder="Select range…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="under_5m">Under LKR 5 million</SelectItem>
                <SelectItem value="5_10m">LKR 5–10 million</SelectItem>
                <SelectItem value="10_15m">LKR 10–15 million</SelectItem>
                <SelectItem value="15m_plus">LKR 15 million+</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Can you invest funds for a Student Visa pathway?">
            <YesNo value={data.canInvestStudent} onChange={(v) => onChange("canInvestStudent", v)} id="invest-student" />
          </Field>
        </div>
      </section>

      <Separator />

      {/* 2. Adaptability & Foreign Ties */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-primary uppercase tracking-wide">
          2. Adaptability &amp; Foreign Ties
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Field label="Close relative (sibling/parent) in destination country as PR/Citizen?">
            <YesNo value={data.relativeInCountry} onChange={(v) => onChange("relativeInCountry", v)} id="relative" />
          </Field>

          <Field label="Previously studied in the destination country?">
            <YesNo value={data.prevEduAbroad} onChange={(v) => onChange("prevEduAbroad", v)} id="prev-edu" />
          </Field>

          <Field label="Previously worked in the destination country?">
            <YesNo value={data.prevWorkAbroad} onChange={(v) => onChange("prevWorkAbroad", v)} id="prev-work" />
          </Field>

          <Field label="Do you have a valid Job Offer / LMIA from a Canadian employer?">
            <Select value={data.hasJobOffer || undefined} onValueChange={(v) => onChange("hasJobOffer", v)}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes_lmia">Yes, with LMIA</SelectItem>
                <SelectItem value="yes_no_lmia">Yes, without LMIA</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      <Separator />

      {/* 3. Background Checks */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-primary uppercase tracking-wide">
          3. Background Checks
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Field label="Any serious medical condition for you or family?">
            <YesNo value={data.hasMedicalCondition} onChange={(v) => onChange("hasMedicalCondition", v)} id="medical" />
          </Field>

          <Field label="Any criminal record in any country?">
            <YesNo value={data.hasCriminalRecord} onChange={(v) => onChange("hasCriminalRecord", v)} id="criminal" />
          </Field>

          <Field label="Any previous visa refusal?">
            <YesNo value={data.hasVisaRefusal} onChange={(v) => onChange("hasVisaRefusal", v)} id="visa-refusal" />
          </Field>
        </div>
      </section>

    </div>
  );
}

export function QuestionnaireForm() {
  const router = useRouter();
  const journey = useClientJourneyOptional();
  const [step, setStep]           = useState<1 | 2 | 3>(1);
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData]   = useState<FormData>(() => ({
    ...INITIAL,
    main:   { ...INITIAL.main,   scores: { ...EMPTY_SCORES } },
    spouse: { ...INITIAL.spouse, scores: { ...EMPTY_SCORES }, frenchScores: { ...EMPTY_SCORES } },
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [fieldRemarks, setFieldRemarks] = useState<Record<string, FieldRemark>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(true);

  const searchParams = useSearchParams();
  const { setPersons } = useIAQNav();

  // â”€â”€ Load saved draft on mount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    async function load() {
      const token = getToken();
      if (!token) { isLoadingRef.current = false; return; }
      try {
        const res = await fetch(`${API}/questionnaire`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            const s = json.data;
            setFormData((prev) => ({
              ...prev,
              ...(s.step1_data ?? {}),
              ...(s.step3_data ?? {}),
              main: s.main_data
                ? {
                    ...prev.main,
                    ...s.main_data,
                    foreignWorkEntries: Array.isArray((s.main_data as MainData).foreignWorkEntries)
                      ? (s.main_data as MainData).foreignWorkEntries
                      : [],
                  }
                : prev.main,
              spouse: s.spouse_data
                ? {
                    ...prev.spouse,
                    ...s.spouse_data,
                    foreignWorkEntries: Array.isArray((s.spouse_data as SpouseData).foreignWorkEntries)
                      ? (s.spouse_data as SpouseData).foreignWorkEntries
                      : [],
                  }
                : prev.spouse,
              children:     s.children_data     ?? prev.children,
              accompanying: s.accompanying_data ?? prev.accompanying,
            }));
            if (s.field_remarks) setFieldRemarks(s.field_remarks);
          }
        }
      } finally {
        isLoadingRef.current = false;
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Sync persons to sidebar nav context (live)
  useEffect(() => {
    let t = 0;
    const nextPersons = [
      {
        id: "main",
        label: formData.fullName || "Main Applicant",
        tabIndex: t++,
      },
      ...(formData.married === "yes"
        ? [{
            id: "spouse",
            label: formData.spouse.fullName ? `(Spouse) ${formData.spouse.fullName}` : "(Spouse)",
            tabIndex: t++,
          }]
        : []),
      ...formData.children.map((child, i) => ({
        id: `child-${i}`,
        label: child.name ? `(Child) ${child.name}` : `(Child) ${i + 1}`,
        tabIndex: t++,
      })),
      ...formData.accompanying.map((acc, i) => {
        const idx = t++;
        return {
          id: `acc-${i}`,
          label: acc.fullName ? `(Other) ${acc.fullName}` : `(Other) ${i + 1}`,
          tabIndex: idx,
        };
      }),
    ];
    setPersons(nextPersons);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.fullName, formData.married, formData.spouse.fullName, formData.children, formData.accompanying]);

  // Jump to tab from ?tab= URL param (deep-link from sidebar nav)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === null) return;
    const tabIdx = parseInt(tabParam, 10);
    if (!isNaN(tabIdx)) {
      setStep(2);
      setActiveTab(tabIdx);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // â”€â”€ Autosave — debounced 1.5 s after any formData change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (isLoadingRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveToServer(formData);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  // Sync children array length
  useEffect(() => {
    const count = childCount(formData.dependentChildren);
    setFormData((prev) => {
      if (prev.children.length === count) return prev;
      if (count > prev.children.length) {
        const added = Array.from({ length: count - prev.children.length }, () => ({
          name: "", dob: "", educationLevel: "",
          passportName: "", governmentIdName: "", governmentIdBackName: "",
          drivingLicenseName: "", drivingLicenseBackName: "",
          passportFullName: "", passportNumber: "", passportIssueDate: "", passportExpiry: "",
          passportNationality: "", passportGender: "",
          nicFullName: "", nicNumber: "", nicDob: "", nicAddress: "",
          nicBirthPlace: "", nicIssueDate: "",
          languages: [],
        }));
        return { ...prev, children: [...prev.children, ...added] };
      }
      return { ...prev, children: prev.children.slice(0, count) };
    });
  }, [formData.dependentChildren]);

  // Keep spouse education in sync when assessment-step spouseEduLevel is set (legacy drafts)
  useEffect(() => {
    if (formData.married !== "yes" || !formData.spouseEduLevel) return;
    setFormData((prev) => {
      const levels = prev.spouse.educationLevels ?? [];
      if (levels.includes(formData.spouseEduLevel)) return prev;
      if (levels.length > 0) return prev;
      return {
        ...prev,
        spouse: { ...prev.spouse, educationLevels: [formData.spouseEduLevel] },
      };
    });
  }, [formData.spouseEduLevel, formData.married]);

  // Sync accompanying persons array length
  useEffect(() => {
    if (formData.hasAccompanying !== "yes") {
      setFormData((prev) => prev.accompanying.length === 0 ? prev : { ...prev, accompanying: [] });
      return;
    }
    const count = accompanyingCount(formData.accompanyingCount);
    setFormData((prev) => {
      if (prev.accompanying.length === count) return prev;
      if (count > prev.accompanying.length) {
        const added = Array.from({ length: count - prev.accompanying.length }, () => ({
          fullName: "", dob: "", relationship: "", otherRelationship: "",
          passportName: "", governmentIdName: "", governmentIdBackName: "",
          drivingLicenseName: "", drivingLicenseBackName: "",
          passportFullName: "", passportNumber: "", passportIssueDate: "", passportExpiry: "",
          passportNationality: "", passportGender: "",
          nicFullName: "", nicNumber: "", nicDob: "", nicAddress: "",
          nicBirthPlace: "", nicIssueDate: "",
          languages: [],
        }));
        return { ...prev, accompanying: [...prev.accompanying, ...added] };
      }
      return { ...prev, accompanying: prev.accompanying.slice(0, count) };
    });
  }, [formData.hasAccompanying, formData.accompanyingCount]);

  // Build dynamic tabs
  const tabs = [
    { id: "main", label: formData.fullName || "Main Applicant", icon: User },
    ...(formData.married === "yes"
      ? [{ id: "spouse", label: formData.spouse.fullName ? `(Spouse) ${formData.spouse.fullName}` : "(Spouse)", icon: Users }]
      : []),
    ...formData.children.map((child, i) => ({
      id: `child_${i}`,
      label: child.name ? `(Child) ${child.name}` : `(Child) ${i + 1}`,
      icon: Baby,
    })),
    ...formData.accompanying.map((person, i) => ({
      id: `accompanying_${i}`,
      label: person.fullName ? `(Other) ${person.fullName}` : `(Other) ${i + 1}`,
      icon: UserPlus,
    })),
  ];

  // Validation
  function validate1(): boolean {
    const e: Record<string, string> = {};
    if (!formData.fullName.trim())  e.fullName = "Full name is required.";
    if (!formData.email.trim())     e.email    = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
                                    e.email    = "Enter a valid email address.";
    if (!formData.whatsapp.trim())  e.whatsapp = "WhatsApp number is required.";
    if (!formData.married)          e.married  = "Please select your marital status.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext1() {
    if (validate1()) { setStep(2); setActiveTab(0); }
  }

  function handleTabNext() {
    if (activeTab < tabs.length - 1) {
      setActiveTab((t) => t + 1);
    } else {
      // Last tab of Step 2 → go to Step 3
      setStep(3);
    }
  }

  async function handleFinalSubmit() {
    setSubmitting(true);
    try {
      await saveToServer(formData);
      const token = getToken();
      const res = await fetch(`${API}/questionnaire/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error("Submit failed");
      await journey?.refresh();
      router.push("/user-dashboard?questionnaire=submitted");
    } catch {
      setSaveStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  function handleTabBack() {
    if (activeTab > 0) setActiveTab((t) => t - 1);
    else setStep(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setField3(f: keyof FormData, v: any) {
    setFormData((p) => ({ ...p, [f]: v }));
  }

  // Updaters
  function setField(f: keyof FormData, v: string) {
    setFormData((p) => ({ ...p, [f]: v }));
    if (errors[f]) setErrors((p) => { const n = { ...p }; delete n[f as string]; return n; });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setMain(f: keyof MainData, v: any) {
    setFormData((p) => ({ ...p, main: { ...p.main, [f]: v } }));
  }
  function setMainPatch(patch: Record<string, string>) {
    setFormData((p) => ({ ...p, main: { ...p.main, ...patch } }));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setSpouse(f: keyof SpouseData, v: any) {
    setFormData((p) => ({ ...p, spouse: { ...p.spouse, [f]: v } }));
  }
  function setSpousePatch(patch: Record<string, string>) {
    setFormData((p) => ({ ...p, spouse: { ...p.spouse, ...patch } }));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setChild(i: number, f: keyof ChildData, v: any) {
    setFormData((p) => {
      const children = [...p.children];
      children[i] = { ...children[i], [f]: v };
      return { ...p, children };
    });
  }
  function setChildPatch(i: number, patch: Record<string, string>) {
    setFormData((p) => {
      const children = [...p.children];
      children[i] = { ...children[i], ...patch };
      return { ...p, children };
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setAccompanying(i: number, f: keyof AccompanyingPerson, v: any) {
    setFormData((p) => {
      const accompanying = [...p.accompanying];
      accompanying[i] = { ...accompanying[i], [f]: v };
      return { ...p, accompanying };
    });
  }
  function setAccompanyingPatch(i: number, patch: Record<string, string>) {
    setFormData((p) => {
      const accompanying = [...p.accompanying];
      accompanying[i] = { ...accompanying[i], ...patch };
      return { ...p, accompanying };
    });
  }
  const handleDocUpload = useCallback(async (file: File): Promise<string> => {
    return uploadDocumentFile(file);
  }, []);

  const saveBadge = saveStatus === "saving" ? (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />Saving…
    </span>
  ) : saveStatus === "saved" ? (
    <span className="text-xs text-green-600">Saved</span>
  ) : saveStatus === "error" ? (
    <span className="text-xs text-destructive">Save failed</span>
  ) : null;

  return (
    <ClientJourneyPageChrome
      stepId="questionnaire"
      description="Complete your profile so your consultant can assess your eligibility and recommend the best pathway."
      extra={saveBadge}
    >
      {/* Step indicator */}
      <StepIndicator step={step} />

      {Object.values(fieldRemarks).some((r) => r.status === "pending") && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <RotateCcw className="size-4" />
            Your consultant requested corrections
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Please review the notes below, update the highlighted fields, and save your changes.
          </p>
          <ul className="mt-3 space-y-2">
            {Object.entries(fieldRemarks)
              .filter(([, r]) => r.status === "pending")
              .map(([key, r]) => (
                <li key={key} className="rounded-lg border border-amber-200/80 bg-white/70 px-3 py-2 text-xs">
                  <p className="font-semibold text-foreground">{remarkLabel(key)}</p>
                  <p className="mt-0.5 flex items-start gap-1.5 text-amber-900">
                    <MessageSquare className="mt-0.5 size-3 shrink-0" />
                    {r.remark}
                  </p>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* â”€â”€ STEP 1 â”€â”€ */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General Information</CardTitle>
            <CardDescription>Your basic details and family situation</CardDescription>
          </CardHeader>
          <CardContent>
            <Step1Form
              data={formData}
              errors={errors}
              fieldRemarks={fieldRemarks}
              onChange={setField}
              onSpouseName={(name) => setSpouse("fullName", name)}
              onChildName={(i, name) => setChild(i, "name", name)}
              onAccompanyingName={(i, name) => setAccompanying(i, "fullName", name)}
            />
          </CardContent>
        </Card>
      )}

      {/* â”€â”€ STEP 2 â”€â”€ */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detailed Profile</CardTitle>
            <CardDescription>
              {tabs.length === 1
                ? "Complete your main applicant profile below"
                : `Complete each tab below — ${tabs.map((t) => t.label).join(", ")}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={tabs[activeTab]?.id ?? "main"}
              onValueChange={(id) => {
                const i = tabs.findIndex((t) => t.id === id);
                if (i !== -1) setActiveTab(i);
              }}
            >
              <TabsList className="mb-6 !inline-flex w-full !h-auto flex-wrap gap-1.5 p-1.5">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="!flex-none !h-auto py-1.5 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground dark:data-[state=active]:border-primary"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value="main">
                <MainApplicantTab
                  data={formData.main}
                  onChange={setMain}
                  onPatch={setMainPatch}
                  onDocUpload={handleDocUpload}
                  fieldRemarks={fieldRemarks}
                />
              </TabsContent>
              <TabsContent value="spouse">
                <SpouseTab
                  data={formData.spouse}
                  onChange={setSpouse}
                  onPatch={setSpousePatch}
                  onDocUpload={handleDocUpload}
                  fieldRemarks={fieldRemarks}
                />
              </TabsContent>
              {formData.children.map((child, i) => (
                <TabsContent key={`child_${i}`} value={`child_${i}`}>
                  <ChildSingleTab
                    data={child}
                    onChange={(f, v) => setChild(i, f, v)}
                    onPatch={(patch) => setChildPatch(i, patch)}
                    onDocUpload={handleDocUpload}
                    fieldRemarks={fieldRemarks}
                    childIndex={i}
                  />
                </TabsContent>
              ))}
              {formData.accompanying.map((person, i) => (
                <TabsContent key={`accompanying_${i}`} value={`accompanying_${i}`}>
                  <AccompanyingPersonSingleTab
                    data={person}
                    onChange={(f, v) => setAccompanying(i, f, v)}
                    onPatch={(patch) => setAccompanyingPatch(i, patch)}
                    onDocUpload={handleDocUpload}
                    fieldRemarks={fieldRemarks}
                    personIndex={i}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* â”€â”€ Navigation footer â”€â”€ */}

      {/* ── STEP 3 ── */}
      {step === 3 && (
        <ReviewStep
          data={formData}
          onEdit1={() => setStep(1)}
          onEdit2={(tabIdx) => { setStep(2); setActiveTab(tabIdx); }}
        />
      )}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        {step === 1 ? (
          <>
            <Button variant="outline" asChild className="h-10 w-full sm:w-auto">
              <Link href="/user-dashboard">
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <Button onClick={handleNext1} className="h-10 w-full sm:w-auto">
              Next — Detailed Profile
              <ChevronRight className="ml-1.5 h-4 w-4" />
            </Button>
          </>
        ) : step === 2 ? (
          <>
            <Button variant="outline" onClick={handleTabBack} className="h-10 w-full sm:w-auto">
              <ChevronLeft className="mr-1.5 h-4 w-4" />
              {activeTab === 0 ? "Back to General Info" : "Previous Tab"}
            </Button>

            {/* Tab progress dots */}
            {tabs.length > 1 && (
              <div className="flex items-center justify-center gap-1.5">
                {tabs.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      i === activeTab ? "w-5 bg-primary" : "w-2 bg-muted-foreground/30",
                    )}
                  />
                ))}
              </div>
            )}

            {activeTab < tabs.length - 1 ? (
              <Button onClick={handleTabNext} className="h-10 w-full sm:w-auto">
                Next Tab
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleTabNext} className="h-10 w-full sm:w-auto">
                Next — Review
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => { setStep(2); setActiveTab(tabs.length - 1); }} className="h-10 w-full sm:w-auto">
              <ChevronLeft className="mr-1.5 h-4 w-4" />
              Back to Detailed Profile
            </Button>
            <Button
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="h-10 w-full bg-green-600 text-white hover:bg-green-700 sm:w-auto"
            >
                {submitting ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Submitting…</>
                ) : (
                  <><Send className="mr-1.5 h-4 w-4" />Submit Questionnaire</>
                )}
              </Button>
          </>
        )}
      </div>
    </ClientJourneyPageChrome>
  );
}

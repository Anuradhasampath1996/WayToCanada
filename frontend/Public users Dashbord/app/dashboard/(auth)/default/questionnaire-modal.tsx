"use client";

import { useState, useEffect } from "react";
import {
  X, ChevronLeft, ChevronRight, Check,
  User, Users, Baby, CheckCircle2, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoreSet {
  listening: string;
  reading: string;
  writing: string;
  speaking: string;
}

interface MainApplicantData {
  dob: string;
  education: string;
  studiedInCanada: string;
  languageTest: string;
  scores: ScoreSet;
  workExperience: string;
  canadianWork: string;
  jobOffer: string;
  settlementFunds: string;
  canadianRelatives: string;
}

interface SpouseData {
  fullName: string;
  dob: string;
  education: string;
  languageTest: string;
  scores: ScoreSet;
  canadianWork: string;
}

interface ChildData {
  name: string;
  dob: string;
  educationLevel: string;
}

export interface QuestionnaireFormData {
  // Step 1 — General Information
  fullName: string;
  email: string;
  whatsapp: string;
  visaType: string;
  married: string;
  dependentChildren: string;
  // Step 2 — Detailed Profile
  main: MainApplicantData;
  spouse: SpouseData;
  children: ChildData[];
}

// ── Initial state ─────────────────────────────────────────────────────────────

const EMPTY_SCORES: ScoreSet = { listening: "", reading: "", writing: "", speaking: "" };

const INITIAL_DATA: QuestionnaireFormData = {
  fullName: "",
  email: "",
  whatsapp: "",
  visaType: "",
  married: "",
  dependentChildren: "0",
  main: {
    dob: "",
    education: "",
    studiedInCanada: "",
    languageTest: "",
    scores: { ...EMPTY_SCORES },
    workExperience: "",
    canadianWork: "",
    jobOffer: "",
    settlementFunds: "",
    canadianRelatives: "",
  },
  spouse: {
    fullName: "",
    dob: "",
    education: "",
    languageTest: "",
    scores: { ...EMPTY_SCORES },
    canadianWork: "",
  },
  children: [],
};

function getChildCount(val: string): number {
  if (val === "4+") return 4;
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

// ── Styled Primitives ─────────────────────────────────────────────────────────

function DLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-300 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
  );
}

function DInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-lg border border-gray-600 bg-gray-700/80 px-3.5 py-2.5 text-sm text-white",
        "placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        "transition-colors disabled:opacity-50",
        className,
      )}
    />
  );
}

function DSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-lg border border-gray-600 bg-gray-700/80 px-3.5 py-2.5 text-sm text-white",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        "transition-colors disabled:opacity-50",
        className,
      )}
    >
      {children}
    </select>
  );
}

interface DRadioGroupProps {
  label: string;
  name: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  error?: string;
}

function DRadioGroup({ label, name, value, onChange, required, error }: DRadioGroupProps) {
  return (
    <div>
      <DLabel required={required}>{label}</DLabel>
      <div className="flex gap-6 mt-1">
        {[{ label: "Yes", val: "yes" }, { label: "No", val: "no" }].map((opt) => (
          <label key={opt.val} className="flex items-center gap-2.5 cursor-pointer group">
            <div
              className={cn(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                value === opt.val
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-500 group-hover:border-gray-400",
              )}
            >
              {value === opt.val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <input
              type="radio"
              name={name}
              value={opt.val}
              checked={value === opt.val}
              onChange={() => onChange(opt.val)}
              className="sr-only"
            />
            <span className="text-sm text-gray-300">{opt.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function ScoreInputs({
  scores,
  onChange,
}: {
  scores: ScoreSet;
  onChange: (field: keyof ScoreSet, val: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {(["listening", "reading", "writing", "speaking"] as (keyof ScoreSet)[]).map((field) => (
        <div key={field}>
          <label className="block text-xs font-medium text-gray-400 mb-1 capitalize">{field}</label>
          <input
            type="number"
            min={0}
            max={9}
            step={0.5}
            value={scores[field]}
            onChange={(e) => onChange(field, e.target.value)}
            placeholder="0–9"
            className="w-full rounded-lg border border-gray-600 bg-gray-700/80 px-3 py-2.5 text-sm text-white text-center placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ))}
    </div>
  );
}

// ── Step 1: General Information ───────────────────────────────────────────────

function Step1Form({
  data,
  errors,
  onChange,
}: {
  data: QuestionnaireFormData;
  errors: Record<string, string>;
  onChange: (field: keyof QuestionnaireFormData, value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">General Information</h2>
        <p className="text-sm text-gray-400">
          Provide your basic details to start the immigration profile assessment.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <DLabel required>Full Name</DLabel>
          <DInput
            type="text"
            value={data.fullName}
            onChange={(e) => onChange("fullName", e.target.value)}
            placeholder="As in Passport"
          />
          {errors.fullName && <p className="mt-1.5 text-xs text-red-400">{errors.fullName}</p>}
        </div>

        <div>
          <DLabel required>Email Address</DLabel>
          <DInput
            type="email"
            value={data.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="your@email.com"
          />
          {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>}
        </div>

        <div>
          <DLabel required>WhatsApp Number</DLabel>
          <DInput
            type="text"
            value={data.whatsapp}
            onChange={(e) => onChange("whatsapp", e.target.value)}
            placeholder="+1 234 567 8900"
          />
          {errors.whatsapp && <p className="mt-1.5 text-xs text-red-400">{errors.whatsapp}</p>}
        </div>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 space-y-5">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-400" />
          Family Accompanying Details
        </h3>

        <DRadioGroup
          label="Are you legally married or in a common-law relationship?"
          name="married"
          value={data.married}
          onChange={(v) => onChange("married", v)}
          required
          error={errors.married}
        />

        <div>
          <DLabel required>How many dependent children are accompanying you?</DLabel>
          <DSelect
            value={data.dependentChildren}
            onChange={(e) => onChange("dependentChildren", e.target.value)}
          >
            <option value="0">0 — No children</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4+">4+</option>
          </DSelect>
        </div>
      </div>
    </div>
  );
}

// ── Tab 1: Main Applicant ─────────────────────────────────────────────────────

function MainApplicantTab({
  data,
  onChange,
}: {
  data: MainApplicantData;
  onChange: (field: keyof MainApplicantData, value: string | ScoreSet) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <DLabel required>Date of Birth</DLabel>
          <DInput
            type="date"
            value={data.dob}
            onChange={(e) => onChange("dob", e.target.value)}
          />
        </div>

        <div>
          <DLabel required>Highest Level of Education</DLabel>
          <DSelect
            value={data.education}
            onChange={(e) => onChange("education", e.target.value)}
          >
            <option value="" disabled>Select education level...</option>
            <option value="masters">Master&apos;s Degree</option>
            <option value="bachelors">Bachelor&apos;s Degree (3+ years)</option>
            <option value="diploma">Two-Year Diploma</option>
            <option value="highschool">High School</option>
          </DSelect>
        </div>
      </div>

      <DRadioGroup
        label="Did you study full-time in Canada for at least 2 years?"
        name="studiedInCanada"
        value={data.studiedInCanada}
        onChange={(v) => onChange("studiedInCanada", v)}
      />

      <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-200">Language Proficiency</h3>
        <div>
          <DLabel>Have you taken an IELTS or CELPIP test?</DLabel>
          <DSelect
            value={data.languageTest}
            onChange={(e) => onChange("languageTest", e.target.value)}
          >
            <option value="" disabled>Select...</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </DSelect>
        </div>
        {data.languageTest === "yes" && (
          <div>
            <p className="text-xs text-gray-400 mb-3">Enter your test scores (0–9, increments of 0.5)</p>
            <ScoreInputs
              scores={data.scores}
              onChange={(f, v) => onChange("scores", { ...data.scores, [f]: v })}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <DLabel required>Foreign Work Experience (past 10 years)</DLabel>
          <DSelect
            value={data.workExperience}
            onChange={(e) => onChange("workExperience", e.target.value)}
          >
            <option value="" disabled>Select experience...</option>
            <option value="less_than_1">Less than 1 year</option>
            <option value="1_to_2">1–2 years</option>
            <option value="3_or_more">3 years or more</option>
          </DSelect>
        </div>

        <div>
          <DLabel>Settlement Funds Available (CAD)</DLabel>
          <DInput
            type="number"
            value={data.settlementFunds}
            onChange={(e) => onChange("settlementFunds", e.target.value)}
            placeholder="Available funds in CAD"
            min={0}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <DRadioGroup
          label="Do you have 1 year of authorized Canadian work experience?"
          name="canadianWork"
          value={data.canadianWork}
          onChange={(v) => onChange("canadianWork", v)}
        />
        <DRadioGroup
          label="Do you have a valid Job Offer from a Canadian employer?"
          name="jobOffer"
          value={data.jobOffer}
          onChange={(v) => onChange("jobOffer", v)}
        />
        <DRadioGroup
          label="Do you or your spouse have a sibling in Canada as PR/Citizen?"
          name="canadianRelatives"
          value={data.canadianRelatives}
          onChange={(v) => onChange("canadianRelatives", v)}
        />
      </div>
    </div>
  );
}

// ── Tab 2: Spouse Details ─────────────────────────────────────────────────────

function SpouseTab({
  data,
  onChange,
}: {
  data: SpouseData;
  onChange: (field: keyof SpouseData, value: string | ScoreSet) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <DLabel required>Spouse Full Name</DLabel>
          <DInput
            type="text"
            value={data.fullName}
            onChange={(e) => onChange("fullName", e.target.value)}
            placeholder="As in Passport"
          />
        </div>
        <div>
          <DLabel required>Spouse Date of Birth</DLabel>
          <DInput
            type="date"
            value={data.dob}
            onChange={(e) => onChange("dob", e.target.value)}
          />
        </div>
      </div>

      <div>
        <DLabel required>Spouse Highest Level of Education</DLabel>
        <DSelect
          value={data.education}
          onChange={(e) => onChange("education", e.target.value)}
        >
          <option value="" disabled>Select education level...</option>
          <option value="masters">Master&apos;s Degree</option>
          <option value="bachelors">Bachelor&apos;s Degree (3+ years)</option>
          <option value="diploma">Two-Year Diploma</option>
          <option value="highschool">High School</option>
        </DSelect>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-200">Spouse Language Proficiency</h3>
        <div>
          <DLabel>Has your spouse taken an IELTS or CELPIP test?</DLabel>
          <DSelect
            value={data.languageTest}
            onChange={(e) => onChange("languageTest", e.target.value)}
          >
            <option value="" disabled>Select...</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </DSelect>
        </div>
        {data.languageTest === "yes" && (
          <div>
            <p className="text-xs text-gray-400 mb-3">
              Enter spouse&apos;s test scores (0–9, increments of 0.5)
            </p>
            <ScoreInputs
              scores={data.scores}
              onChange={(f, v) => onChange("scores", { ...data.scores, [f]: v })}
            />
          </div>
        )}
      </div>

      <DRadioGroup
        label="Does your spouse have 1 year of authorized Canadian work experience?"
        name="spouseCanadianWork"
        value={data.canadianWork}
        onChange={(v) => onChange("canadianWork", v)}
      />
    </div>
  );
}

// ── Tab 3: Children Details ───────────────────────────────────────────────────

function ChildrenTab({
  children,
  onChange,
}: {
  children: ChildData[];
  onChange: (index: number, field: keyof ChildData, value: string) => void;
}) {
  return (
    <div className="space-y-5">
      {children.map((child, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
              {i + 1}
            </div>
            <h3 className="text-sm font-semibold text-gray-200">Child {i + 1}</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <DLabel>Child&apos;s Full Name</DLabel>
              <DInput
                type="text"
                value={child.name}
                onChange={(e) => onChange(i, "name", e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div>
              <DLabel>Date of Birth</DLabel>
              <DInput
                type="date"
                value={child.dob}
                onChange={(e) => onChange(i, "dob", e.target.value)}
              />
            </div>
          </div>

          <div>
            <DLabel>Current Education Level</DLabel>
            <DSelect
              value={child.educationLevel}
              onChange={(e) => onChange(i, "educationLevel", e.target.value)}
            >
              <option value="" disabled>Select level...</option>
              <option value="primary">Primary School</option>
              <option value="secondary">Secondary School</option>
              <option value="none">None / Pre-school</option>
            </DSelect>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Modal Component ──────────────────────────────────────────────────────

interface QuestionnaireModalProps {
  onClose: () => void;
}

export function QuestionnaireModal({ onClose }: QuestionnaireModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState<QuestionnaireFormData>(() => ({
    ...INITIAL_DATA,
    main: { ...INITIAL_DATA.main, scores: { ...EMPTY_SCORES } },
    spouse: { ...INITIAL_DATA.spouse, scores: { ...EMPTY_SCORES } },
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Keep children array length in sync with dependentChildren selection
  useEffect(() => {
    const count = getChildCount(formData.dependentChildren);
    setFormData((prev) => {
      const current = prev.children;
      if (current.length === count) return prev;
      if (count > current.length) {
        const added = Array.from({ length: count - current.length }, () => ({
          name: "",
          dob: "",
          educationLevel: "",
        }));
        return { ...prev, children: [...current, ...added] };
      }
      return { ...prev, children: current.slice(0, count) };
    });
  }, [formData.dependentChildren]);

  // Build dynamic tabs for step 2
  const tabs = [
    { id: "main", label: "Main Applicant", icon: User },
    ...(formData.married === "yes"
      ? [{ id: "spouse", label: "Spouse Details", icon: Users }]
      : []),
    ...(getChildCount(formData.dependentChildren) > 0
      ? [{ id: "children", label: "Children Details", icon: Baby }]
      : []),
  ];

  // ── Validation ────────────────────────────────────────────────────────────

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!formData.fullName.trim()) errs.fullName = "Full name is required.";
    if (!formData.email.trim()) {
      errs.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = "Please enter a valid email address.";
    }
    if (!formData.whatsapp.trim()) errs.whatsapp = "WhatsApp number is required.";
    if (!formData.married) errs.married = "Please select your marital status.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function handleStep1Next() {
    if (validateStep1()) {
      setStep(2);
      setActiveTab(0);
    }
  }

  function handleTabNext() {
    if (activeTab < tabs.length - 1) {
      setActiveTab((t) => t + 1);
    } else {
      setSubmitted(true);
    }
  }

  function handleTabBack() {
    if (activeTab > 0) {
      setActiveTab((t) => t - 1);
    } else {
      setStep(1);
    }
  }

  // ── State updaters ────────────────────────────────────────────────────────

  function updateField(field: keyof QuestionnaireFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  }

  function updateMain(field: keyof MainApplicantData, value: string | ScoreSet) {
    setFormData((prev) => ({ ...prev, main: { ...prev.main, [field]: value } }));
  }

  function updateSpouse(field: keyof SpouseData, value: string | ScoreSet) {
    setFormData((prev) => ({ ...prev, spouse: { ...prev.spouse, [field]: value } }));
  }

  function updateChild(index: number, field: keyof ChildData, value: string) {
    setFormData((prev) => {
      const children = [...prev.children];
      children[index] = { ...children[index], [field]: value };
      return { ...prev, children };
    });
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-700 p-10 text-center space-y-5">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white">Questionnaire Submitted!</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Thank you,{" "}
            <span className="text-white font-medium">{formData.fullName}</span>! Your
            assessment questionnaire has been submitted. Your consultant will review your
            profile and reach out to you shortly.
          </p>
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-sm transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  const activeTabId = tabs[activeTab]?.id ?? "main";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-900/95 shrink-0">
        <div className="flex items-center gap-6">
          {/* Step tracker */}
          <div className="flex items-center gap-2">
            {[
              { num: 1, label: "General Info" },
              { num: 2, label: "Detailed Profile" },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center gap-2">
                {i > 0 && (
                  <div
                    className={cn(
                      "w-8 h-px",
                      step > i ? "bg-blue-500" : "bg-gray-600",
                    )}
                  />
                )}
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all shrink-0",
                      step === s.num
                        ? "bg-blue-600 text-white"
                        : step > s.num
                          ? "bg-green-600 text-white"
                          : "bg-gray-700 text-gray-400",
                    )}
                  >
                    {step > s.num ? <Check className="h-3.5 w-3.5" /> : s.num}
                  </div>
                  <span
                    className={cn(
                      "text-sm hidden sm:block",
                      step === s.num
                        ? "text-white font-semibold"
                        : step > s.num
                          ? "text-green-400"
                          : "text-gray-500",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:block">
            Immigration Assessment Questionnaire
          </span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        {step === 1 ? (
          <div className="max-w-2xl mx-auto px-6 py-8">
            <Step1Form data={formData} errors={errors} onChange={updateField} />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6">

            {/* Tab bar */}
            <div className="flex gap-1 rounded-xl bg-gray-800 p-1.5 mb-6">
              {tabs.map((tab, i) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(i)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                      activeTab === i
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-400 hover:text-gray-200 hover:bg-gray-700",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:block">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            {activeTabId === "main" && (
              <MainApplicantTab data={formData.main} onChange={updateMain} />
            )}
            {activeTabId === "spouse" && (
              <SpouseTab data={formData.spouse} onChange={updateSpouse} />
            )}
            {activeTabId === "children" && (
              <ChildrenTab children={formData.children} onChange={updateChild} />
            )}
          </div>
        )}
      </div>

      {/* ── Footer navigation ── */}
      <div className="shrink-0 border-t border-gray-700 bg-gray-900/95 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          {step === 1 ? (
            <>
              <button
                onClick={onClose}
                className="flex items-center gap-2 rounded-xl border border-gray-600 hover:border-gray-500 bg-transparent text-gray-300 hover:text-white px-5 py-2.5 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStep1Next}
                className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-sm font-semibold transition-colors ml-auto"
              >
                Next — Detailed Profile
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleTabBack}
                className="flex items-center gap-2 rounded-xl border border-gray-600 hover:border-gray-500 bg-transparent text-gray-300 hover:text-white px-5 py-2.5 text-sm font-medium transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                {activeTab === 0 ? "Back to General Info" : "Previous Tab"}
              </button>

              {/* Tab progress dots */}
              <div className="flex items-center gap-2">
                {tabs.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      i === activeTab ? "bg-blue-500 w-5" : "bg-gray-600 w-2",
                    )}
                  />
                ))}
              </div>

              {activeTab < tabs.length - 1 ? (
                <button
                  onClick={handleTabNext}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
                >
                  Next Tab
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleTabNext}
                  className="flex items-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
                >
                  <Send className="h-4 w-4" />
                  Submit Questionnaire
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

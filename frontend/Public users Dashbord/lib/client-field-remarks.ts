import type { FieldRemark } from "@/lib/client-questionnaire-stats";

const FIELD_LABELS: Record<string, string> = {
  "step1_data.fullName": "Full name",
  "step1_data.email": "Email",
  "step1_data.whatsapp": "WhatsApp",
  "main_data.fullName": "Full name",
  "main_data.dob": "Date of birth",
  "main_data.passportNumber": "Passport number",
  "main_data.passportFullName": "Name on passport",
  "main_data.passportExpiry": "Passport expiry",
  "main_data.passportName": "Passport document",
  "main_data.governmentIdName": "ID front",
  "main_data.governmentIdBackName": "ID back",
  "main_data.drivingLicenseName": "Driving license front",
  "main_data.drivingLicenseBackName": "Driving license back",
  "main_data.languageTestDocName": "Language test certificate",
  "main_data.canadaStudyDocName": "Study proof document",
};

/** Maps consultant dot-path → client questionnaire tab index (step 2) */
export function remarkTabIndex(fieldKey: string): number | null {
  if (fieldKey.startsWith("step1_data.")) return null;
  if (fieldKey.startsWith("main_data.")) return 0;
  if (fieldKey.startsWith("spouse_data.")) return 1;
  const child = fieldKey.match(/^children_data\.(\d+)\./);
  if (child) return 2 + parseInt(child[1], 10);
  const acc = fieldKey.match(/^accompanying_data\.(\d+)\./);
  if (acc) return 2 + parseInt(acc[1], 10);
  return null;
}

export function remarkFieldKey(fieldKey: string): string {
  const parts = fieldKey.split(".");
  if (fieldKey.startsWith("children_data.") || fieldKey.startsWith("accompanying_data.")) {
    return parts.slice(2).join(".");
  }
  return parts.slice(1).join(".");
}

export function remarkLabel(fieldKey: string): string {
  if (FIELD_LABELS[fieldKey]) return FIELD_LABELS[fieldKey];
  const tail = fieldKey.split(".").pop() ?? fieldKey;
  return tail.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export function getPendingRemark(
  remarks: Record<string, FieldRemark>,
  consultantKey: string,
): FieldRemark | undefined {
  const r = remarks[consultantKey];
  return r?.status === "pending" ? r : undefined;
}

/** Build consultant key from client form location */
export function clientToConsultantKey(
  tabKind: "step1" | "main" | "spouse" | "child" | "accompanying",
  field: string,
  index?: number,
): string {
  if (tabKind === "step1") return `step1_data.${field}`;
  if (tabKind === "main") return `main_data.${field}`;
  if (tabKind === "spouse") return `spouse_data.${field}`;
  if (tabKind === "child" && index != null) return `children_data.${index}.${field}`;
  if (tabKind === "accompanying" && index != null) return `accompanying_data.${index}.${field}`;
  return `main_data.${field}`;
}

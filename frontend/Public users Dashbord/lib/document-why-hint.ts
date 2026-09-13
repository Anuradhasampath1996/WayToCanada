/** Plain-language “why we need this” hints for common case document types. */
const HINTS_BY_ID: Record<string, string> = {
  passport: "Clear photo or scan of the bio data page (name, photo, passport number, expiry).",
  passport_bio: "Clear photo or scan of the bio data page (name, photo, passport number, expiry).",
  passport_biodata: "Clear photo or scan of the bio data page (name, photo, passport number, expiry).",
  national_id: "Front (and back if required) of your government-issued ID.",
  government_id: "Front (and back if required) of your government-issued ID.",
  birth_certificate: "Official birth certificate showing your full name and date of birth.",
  marriage_certificate: "Official marriage certificate if your spouse is part of the application.",
  police_certificate: "Police clearance / certificate of good conduct from countries where you lived.",
  police_clearance: "Police clearance / certificate of good conduct from countries where you lived.",
  medical_exam: "IRCC medical exam results or confirmation from the panel physician.",
  proof_of_funds: "Bank statements or letters showing funds available for settlement.",
  bank_statement: "Recent bank statements showing available funds.",
  employment_letter: "Letter from your employer confirming role, dates, and salary.",
  pay_stubs: "Recent pay stubs matching your employment history.",
  education_diploma: "Diploma or degree certificate for your highest education.",
  education_transcript: "Official transcripts for your claimed education.",
  language_test: "IELTS, CELPIP, TEF, or TCF results — all pages of the report.",
  study_permit: "Your study permit or letter of acceptance, if applicable.",
  work_permit: "Your work permit, if you have one.",
  photos: "Passport-style photos meeting IRCC size and background rules.",
  photo: "Passport-style photos meeting IRCC size and background rules.",
};

const HINTS_BY_CATEGORY: Record<string, string> = {
  identity: "Proof of who you are — clear, readable scans preferred.",
  background: "Background or clearance documents your consultant requested.",
  medical: "Medical exam or health-related documents for IRCC.",
  financial: "Proof you can support yourself (and family) in Canada.",
  work: "Evidence of your work experience and job history.",
  eligibility: "Documents that support your eligibility for this pathway.",
  application: "Forms or letters related to your application package.",
  study: "Study history and education credentials.",
  sponsor: "Documents related to your sponsor or family support.",
  relationship: "Proof of relationship (marriage, common-law, family).",
};

export function documentWhyHint(docId: string, category?: string, label?: string): string {
  const key = docId.toLowerCase().replace(/[\s-]+/g, "_");
  if (HINTS_BY_ID[key]) return HINTS_BY_ID[key];

  for (const [id, hint] of Object.entries(HINTS_BY_ID)) {
    if (key.includes(id) || id.includes(key)) return hint;
  }

  const labelKey = (label ?? "").toLowerCase();
  if (labelKey.includes("passport")) return HINTS_BY_ID.passport;
  if (labelKey.includes("police")) return HINTS_BY_ID.police_certificate;
  if (labelKey.includes("fund") || labelKey.includes("bank")) return HINTS_BY_ID.proof_of_funds;
  if (labelKey.includes("language") || labelKey.includes("ielts") || labelKey.includes("celpip")) {
    return HINTS_BY_ID.language_test;
  }
  if (labelKey.includes("marriage")) return HINTS_BY_ID.marriage_certificate;
  if (labelKey.includes("birth")) return HINTS_BY_ID.birth_certificate;
  if (labelKey.includes("photo")) return HINTS_BY_ID.photos;

  if (category && HINTS_BY_CATEGORY[category]) return HINTS_BY_CATEGORY[category];

  return "Upload a clear, complete copy. Your consultant will tell you if anything else is needed.";
}

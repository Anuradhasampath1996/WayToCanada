"""
Patch questionnaire-form.tsx to:
1. Add EduQualification interface + education OCR fields
2. Change eduLevel (string) → eduLevels (string[]) + eduQualifications (EduQualification[])
3. Remove separate eduField/eduYear fields (now inside EduQualification)
4. Add EduQualCard component with document upload + auto-fill
5. Replace Educational Background section with multi-select toggles + per-level upload cards
6. Thread onUpload into Step3Form
"""

FILE = r'frontend\Public users Dashbord\app\user-dashboard\questionnaire\questionnaire-form.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    src = f.read()

patches = []

# ── 1. Add EduQualification interface after OcrExtracted ────────────────────
patches.append((
    '''interface OcrExtracted {
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
}''',
    '''interface OcrExtracted {
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
}

interface EduQualification {
  level: string;
  universityName: string;
  courseName: string;
  graduationYear: string;
  country: string;
  documentName: string;
}'''
))

# ── 2. Update FormData interface ─────────────────────────────────────────────
patches.append((
    '  eduLevel: string; eduField: string; eduYear: string; spouseEduLevel: string;',
    '  eduLevels: string[]; eduQualifications: EduQualification[]; spouseEduLevel: string;'
))

# ── 3. Update INITIAL ────────────────────────────────────────────────────────
patches.append((
    '  // Step 3\n  eduLevel: "", eduField: "", eduYear: "", spouseEduLevel: "",',
    '  // Step 3\n  eduLevels: [], eduQualifications: [], spouseEduLevel: "",'
))

# ── 4. Update saveToServer ────────────────────────────────────────────────────
patches.append((
    '        eduLevel: data.eduLevel, eduField: data.eduField, eduYear: data.eduYear,\n        spouseEduLevel: data.spouseEduLevel,',
    '        eduLevels: data.eduLevels, eduQualifications: data.eduQualifications,\n        spouseEduLevel: data.spouseEduLevel,'
))

# ── 5. Update setField3 type ──────────────────────────────────────────────────
patches.append((
    '  function setField3(f: keyof FormData, v: string | ScoreSet) {\n    setFormData((p) => ({ ...p, [f]: v }));\n  }',
    '  // eslint-disable-next-line @typescript-eslint/no-explicit-any\n  function setField3(f: keyof FormData, v: any) {\n    setFormData((p) => ({ ...p, [f]: v }));\n  }'
))

# ── 6. Insert EDU_LEVELS constant + EduQualCard component before YesNo ───────
patches.append((
    'function YesNo({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {',
    '''const EDU_LEVELS: { value: string; label: string }[] = [
  { value: "phd",       label: "PhD / Doctorate" },
  { value: "masters",   label: "Master\u2019s Degree" },
  { value: "bachelors", label: "Bachelor\u2019s Degree" },
  { value: "diploma",   label: "Diploma (2 yrs)" },
  { value: "al",        label: "A/L" },
  { value: "other",     label: "Other" },
];

const EDU_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  EDU_LEVELS.map(({ value, label }) => [value, label])
);

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

function YesNo({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {'''
))

# ── 7. Update Step3Form signature to add onUpload ────────────────────────────
patches.append((
    '''function Step3Form({
  data,
  onChange,
}: {
  data: FormData;
  onChange: (f: keyof FormData, v: string | ScoreSet) => void;
}) {''',
    '''function Step3Form({
  data,
  onChange,
  onUpload,
}: {
  data: FormData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (f: keyof FormData, v: any) => void;
  onUpload?: (file: File) => Promise<string>;
}) {'''
))

# ── 8. Replace Educational Background section ─────────────────────────────────
OLD_EDU_SECTION = '''      {/* 1. Educational Background */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-primary uppercase tracking-wide">
          1. Educational Background
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Field label="Highest Level of Education" required>
            <Select value={data.eduLevel || undefined} onValueChange={(v) => onChange("eduLevel", v)}>
              <SelectTrigger><SelectValue placeholder="Select level\u2026" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="phd">PhD / Doctorate</SelectItem>
                <SelectItem value="masters">Master&apos;s Degree</SelectItem>
                <SelectItem value="bachelors">Bachelor&apos;s Degree (3+ years)</SelectItem>
                <SelectItem value="diploma">Diploma (2 years)</SelectItem>
                <SelectItem value="al">A/L (Advanced Level)</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Field of Study">
            <Input
              value={data.eduField}
              onChange={(e) => onChange("eduField", e.target.value)}
              placeholder="e.g. Computer Science, Medicine"
            />
          </Field>

          <Field label="Year of Completion">
            <Input
              type="number" min={1970} max={2030}
              value={data.eduYear}
              onChange={(e) => onChange("eduYear", e.target.value)}
              placeholder="e.g. 2018"
            />
          </Field>

          {data.married === "yes" && (
            <Field label="Spouse\'s Highest Education">
              <Select value={data.spouseEduLevel || undefined} onValueChange={(v) => onChange("spouseEduLevel", v)}>
                <SelectTrigger><SelectValue placeholder="Select level\u2026" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phd">PhD / Doctorate</SelectItem>
                  <SelectItem value="masters">Master&apos;s Degree</SelectItem>
                  <SelectItem value="bachelors">Bachelor&apos;s Degree (3+ years)</SelectItem>
                  <SelectItem value="diploma">Diploma (2 years)</SelectItem>
                  <SelectItem value="al">A/L (Advanced Level)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
      </section>'''

NEW_EDU_SECTION = '''      {/* 1. Educational Background */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-primary uppercase tracking-wide">
          1. Educational Background
        </h3>

        {/* Multi-select education level toggles */}
        <Field label="Select all education levels you hold" required>
          <div className="flex flex-wrap gap-2 pt-1">
            {EDU_LEVELS.map(({ value, label }) => {
              const checked = (data.eduLevels ?? []).includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    const current: string[] = data.eduLevels ?? [];
                    const next = checked
                      ? current.filter((l) => l !== value)
                      : [...current, value];
                    const currentQuals: EduQualification[] = data.eduQualifications ?? [];
                    const nextQuals = next.map((l) => {
                      const existing = currentQuals.find((q) => q.level === l);
                      return existing ?? {
                        level: l,
                        universityName: "",
                        courseName: "",
                        graduationYear: "",
                        country: "",
                        documentName: "",
                      };
                    });
                    onChange("eduLevels", next);
                    onChange("eduQualifications", nextQuals);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                    checked
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  )}
                >
                  {checked && <Check className="h-3 w-3" />}
                  {label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Per-level upload cards */}
        {(data.eduQualifications ?? []).length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {(data.eduQualifications ?? []).map((qual, idx) => (
              <EduQualCard
                key={qual.level}
                qual={qual}
                onChange={(updated) => {
                  const next = (data.eduQualifications ?? []).map((q, i) =>
                    i === idx ? updated : q
                  );
                  onChange("eduQualifications", next);
                }}
                onUpload={onUpload}
              />
            ))}
          </div>
        )}

        {/* Spouse education — single select */}
        {data.married === "yes" && (
          <div className="pt-2">
            <Field label="Spouse\'s Highest Education">
              <Select
                value={data.spouseEduLevel || undefined}
                onValueChange={(v) => onChange("spouseEduLevel", v)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select level\u2026" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phd">PhD / Doctorate</SelectItem>
                  <SelectItem value="masters">Master&apos;s Degree</SelectItem>
                  <SelectItem value="bachelors">Bachelor&apos;s Degree (3+ years)</SelectItem>
                  <SelectItem value="diploma">Diploma (2 years)</SelectItem>
                  <SelectItem value="al">A/L (Advanced Level)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
      </section>'''

patches.append((OLD_EDU_SECTION, NEW_EDU_SECTION))

# ── 9. Pass onUpload to Step3Form call ────────────────────────────────────────
patches.append((
    '<Step3Form data={formData} onChange={setField3} />',
    '<Step3Form data={formData} onChange={setField3} onUpload={uploadDocumentFile} />'
))

# ── Apply all patches ─────────────────────────────────────────────────────────
for i, (old, new) in enumerate(patches, 1):
    count = src.count(old)
    if count == 0:
        print(f'ERROR: Patch {i} not found.')
        # Show first 80 chars for debugging
        print(f'  Looking for: {repr(old[:80])}')
        exit(1)
    if count > 1:
        print(f'WARNING: Patch {i} matched {count} times — replacing all.')
    src = src.replace(old, new)
    print(f'Patch {i}: OK ({count} occurrence(s))')

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(src)

print('\nDone. All patches applied.')

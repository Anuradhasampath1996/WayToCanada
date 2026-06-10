"""
Inserts onScanComplete callbacks into the 4 Government ID TwoSidedDocumentCard instances
in questionnaire-form.tsx.
"""
import sys

path = r"c:\Users\anura\Desktop\WayToCanada\WayToCanada\frontend\Public users Dashbord\app\user-dashboard\questionnaire\questionnaire-form.tsx"

with open(path, encoding="utf-8") as fh:
    src = fh.read()

# ── Helper ────────────────────────────────────────────────────────────────────
def replace_once(text, old, new, label):
    count = text.count(old)
    print(f"  [{label}] pattern found {count}x")
    return text.replace(old, new)

# ── Main applicant + Spouse (same onChange signature, no index) ───────────────
old_main = (
    '          onFrontChange={(n) => onChange("governmentIdName", n)}\n'
    '          onBackChange={(n) => onChange("governmentIdBackName", n)}\n'
    '          onUpload={onDocUpload}\n'
    '        />'
)
new_main = (
    '          onFrontChange={(n) => onChange("governmentIdName", n)}\n'
    '          onBackChange={(n) => onChange("governmentIdBackName", n)}\n'
    '          onUpload={onDocUpload}\n'
    '          onScanComplete={(result) => {\n'
    '            const d = result.extracted_data;\n'
    '            if (d.fullName) onChange("nicFullName", d.fullName);\n'
    '            if (d.idNumber) onChange("nicNumber", d.idNumber);\n'
    '            if (d.dob)      onChange("nicDob", d.dob);\n'
    '            if (d.gender && !data.passportGender) onChange("passportGender", d.gender);\n'
    '            if (d.nationality && !data.passportNationality) onChange("passportNationality", d.nationality);\n'
    '          }}\n'
    '        />'
)
src = replace_once(src, old_main, new_main, "main+spouse")

# ── Children (index i, child reference) ──────────────────────────────────────
old_child = (
    '                onFrontChange={(n) => onChange(i, "governmentIdName", n)}\n'
    '                onBackChange={(n) => onChange(i, "governmentIdBackName", n)}\n'
    '                onUpload={onDocUpload}\n'
    '              />\n'
    '              <TwoSidedDocumentCard\n'
    '                title="Driving Licence"\n'
    '                description="If applicable"'
)
new_child = (
    '                onFrontChange={(n) => onChange(i, "governmentIdName", n)}\n'
    '                onBackChange={(n) => onChange(i, "governmentIdBackName", n)}\n'
    '                onUpload={onDocUpload}\n'
    '                onScanComplete={(result) => {\n'
    '                  const d = result.extracted_data;\n'
    '                  if (d.fullName) onChange(i, "nicFullName", d.fullName);\n'
    '                  if (d.idNumber) onChange(i, "nicNumber", d.idNumber);\n'
    '                  if (d.dob)      onChange(i, "nicDob", d.dob);\n'
    '                  if (d.gender && !child.passportGender) onChange(i, "passportGender", d.gender);\n'
    '                  if (d.nationality && !child.passportNationality) onChange(i, "passportNationality", d.nationality);\n'
    '                }}\n'
    '              />\n'
    '              <TwoSidedDocumentCard\n'
    '                title="Driving Licence"\n'
    '                description="If applicable"'
)
src = replace_once(src, old_child, new_child, "children")

# ── Accompanying (index i, person reference) — same pattern as child after above replace ──
old_person = (
    '                onFrontChange={(n) => onChange(i, "governmentIdName", n)}\n'
    '                onBackChange={(n) => onChange(i, "governmentIdBackName", n)}\n'
    '                onUpload={onDocUpload}\n'
    '              />\n'
    '              <TwoSidedDocumentCard\n'
    '                title="Driving Licence"\n'
    '                description="If applicable"'
)
new_person = (
    '                onFrontChange={(n) => onChange(i, "governmentIdName", n)}\n'
    '                onBackChange={(n) => onChange(i, "governmentIdBackName", n)}\n'
    '                onUpload={onDocUpload}\n'
    '                onScanComplete={(result) => {\n'
    '                  const d = result.extracted_data;\n'
    '                  if (d.fullName) onChange(i, "nicFullName", d.fullName);\n'
    '                  if (d.idNumber) onChange(i, "nicNumber", d.idNumber);\n'
    '                  if (d.dob)      onChange(i, "nicDob", d.dob);\n'
    '                  if (d.gender && !person.passportGender) onChange(i, "passportGender", d.gender);\n'
    '                  if (d.nationality && !person.passportNationality) onChange(i, "passportNationality", d.nationality);\n'
    '                }}\n'
    '              />\n'
    '              <TwoSidedDocumentCard\n'
    '                title="Driving Licence"\n'
    '                description="If applicable"'
)
src = replace_once(src, old_person, new_person, "accompanying")

with open(path, "w", encoding="utf-8") as fh:
    fh.write(src)

# Verify
c_no_i = src.count('onChange("nicFullName"')
c_with_i = src.count('onChange(i, "nicFullName"')
print(f"\nnicFullName no-index: {c_no_i} (expect 2 for main+spouse)")
print(f"nicFullName indexed:  {c_with_i} (expect 2 for children+accompanying)")
print("Done.")

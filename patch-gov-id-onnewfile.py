#!/usr/bin/env python3
"""
Patch questionnaire-form.tsx:
- Add onNewFile to all Government ID TwoSidedDocumentCard components
  (main applicant + spouse sections)
- Remove !data.nicFullName / !data.nicNumber / !data.nicDob guards
"""
import re

FILE = r"frontend\Public users Dashbord\app\user-dashboard\questionnaire\questionnaire-form.tsx"

OLD = (
    "          onUpload={onDocUpload}\n"
    "          onScanComplete={(result) => {\n"
    "            const d = result.extracted_data;\n"
    "            if (d.fullName && !data.nicFullName) onChange(\"nicFullName\", d.fullName);\n"
    "            if (d.idNumber && !data.nicNumber)   onChange(\"nicNumber\", d.idNumber);\n"
    "            if (d.dob && !data.nicDob)           onChange(\"nicDob\", d.dob);\n"
    "            if (d.address)                        onChange(\"nicAddress\", d.address);\n"
    "            if (d.birthPlace)                     onChange(\"nicBirthPlace\", d.birthPlace);\n"
    "            if (d.issueDate)                      onChange(\"nicIssueDate\", d.issueDate);\n"
    "            if (d.gender && !data.passportGender) onChange(\"passportGender\", d.gender);\n"
    "            if (d.nationality && !data.passportNationality) onChange(\"passportNationality\", d.nationality);\n"
    "          }}\n"
    "        />\n"
    "        <TwoSidedDocumentCard\n"
    "          title=\"Driving Licence\""
)

NEW = (
    "          onUpload={onDocUpload}\n"
    "          onNewFile={() => {\n"
    "            onChange(\"nicFullName\", \"\");\n"
    "            onChange(\"nicNumber\", \"\");\n"
    "            onChange(\"nicDob\", \"\");\n"
    "            onChange(\"nicAddress\", \"\");\n"
    "            onChange(\"nicBirthPlace\", \"\");\n"
    "            onChange(\"nicIssueDate\", \"\");\n"
    "          }}\n"
    "          onScanComplete={(result) => {\n"
    "            const d = result.extracted_data;\n"
    "            if (d.fullName) onChange(\"nicFullName\", d.fullName);\n"
    "            if (d.idNumber) onChange(\"nicNumber\", d.idNumber);\n"
    "            if (d.dob)      onChange(\"nicDob\", d.dob);\n"
    "            if (d.address)                        onChange(\"nicAddress\", d.address);\n"
    "            if (d.birthPlace)                     onChange(\"nicBirthPlace\", d.birthPlace);\n"
    "            if (d.issueDate)                      onChange(\"nicIssueDate\", d.issueDate);\n"
    "            if (d.gender && !data.passportGender) onChange(\"passportGender\", d.gender);\n"
    "            if (d.nationality && !data.passportNationality) onChange(\"passportNationality\", d.nationality);\n"
    "          }}\n"
    "        />\n"
    "        <TwoSidedDocumentCard\n"
    "          title=\"Driving Licence\""
)

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

count = content.count(OLD)
if count == 0:
    print("ERROR: Pattern not found. Check the file.")
    raise SystemExit(1)

print(f"Found {count} occurrence(s). Replacing all...")
new_content = content.replace(OLD, NEW)

with open(FILE, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"Done. Replaced {count} occurrence(s).")

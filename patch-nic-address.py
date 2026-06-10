"""
Patch 2: Add address callback lines and Address UI inputs to all 4 NIC sections.
"""

path = r"c:\Users\anura\Desktop\WayToCanada\WayToCanada\frontend\Public users Dashbord\app\user-dashboard\questionnaire\questionnaire-form.tsx"

with open(path, encoding="utf-8") as fh:
    src = fh.read()

# ── 1. Main applicant callback (data reference, no index) ────────────────────
old = (
    '            if (d.dob)      onChange("nicDob", d.dob);\n'
    '            if (d.gender && !data.passportGender) onChange("passportGender", d.gender);\n'
    '            if (d.nationality && !data.passportNationality) onChange("passportNationality", d.nationality);\n'
    '          }}\n'
    '        />\n'
    '      </div>\n'
    '      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">\n'
    '        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">National ID / Driving License Details</p>\n'
    '        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">\n'
    '          <Field label="Full Name">\n'
    '            <Input value={data.nicFullName} onChange={(e) => onChange("nicFullName", e.target.value)} placeholder="As on ID document" />\n'
    '          </Field>\n'
    '          <Field label="Document ID Number">\n'
    '            <Input value={data.nicNumber} onChange={(e) => onChange("nicNumber", e.target.value)} placeholder="ID / CNIC Number" />\n'
    '          </Field>\n'
    '          <Field label="Date of Birth">\n'
    '            <Input type="date" value={data.nicDob} onChange={(e) => onChange("nicDob", e.target.value)} />\n'
    '          </Field>\n'
    '        </div>\n'
    '      </div>'
)
new = (
    '            if (d.dob)      onChange("nicDob", d.dob);\n'
    '            if (d.address)  onChange("nicAddress", d.address);\n'
    '            if (d.gender && !data.passportGender) onChange("passportGender", d.gender);\n'
    '            if (d.nationality && !data.passportNationality) onChange("passportNationality", d.nationality);\n'
    '          }}\n'
    '        />\n'
    '      </div>\n'
    '      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">\n'
    '        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">National ID / Driving License Details</p>\n'
    '        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">\n'
    '          <Field label="Full Name">\n'
    '            <Input value={data.nicFullName} onChange={(e) => onChange("nicFullName", e.target.value)} placeholder="As on ID document" />\n'
    '          </Field>\n'
    '          <Field label="Document ID Number">\n'
    '            <Input value={data.nicNumber} onChange={(e) => onChange("nicNumber", e.target.value)} placeholder="ID / CNIC Number" />\n'
    '          </Field>\n'
    '          <Field label="Date of Birth">\n'
    '            <Input type="date" value={data.nicDob} onChange={(e) => onChange("nicDob", e.target.value)} />\n'
    '          </Field>\n'
    '          <Field label="Address on ID">\n'
    '            <Input value={data.nicAddress} onChange={(e) => onChange("nicAddress", e.target.value)} placeholder="Address as on ID document" />\n'
    '          </Field>\n'
    '        </div>\n'
    '      </div>'
)
count = src.count(old)
print(f"main+spouse NIC block found: {count}x")
src = src.replace(old, new)  # replaces both main AND spouse (they're identical)

# ── 2. Children callback + UI (child reference, indent 16sp) ─────────────────
old2 = (
    '                  if (d.dob)      onChange(i, "nicDob", d.dob);\n'
    '                  if (d.gender && !child.passportGender) onChange(i, "passportGender", d.gender);\n'
    '                  if (d.nationality && !child.passportNationality) onChange(i, "passportNationality", d.nationality);\n'
    '                }}\n'
    '              />\n'
    '            </div>\n'
    '            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">\n'
    '              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">National ID / Driving License Details</p>\n'
    '              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">\n'
    '                <Field label="Full Name">\n'
    '                  <Input value={child.nicFullName} onChange={(e) => onChange(i, "nicFullName", e.target.value)} placeholder="As on ID document" />\n'
    '                </Field>\n'
    '                <Field label="Document ID Number">\n'
    '                  <Input value={child.nicNumber} onChange={(e) => onChange(i, "nicNumber", e.target.value)} placeholder="ID / CNIC Number" />\n'
    '                </Field>\n'
    '                <Field label="Date of Birth">\n'
    '                  <Input type="date" value={child.nicDob} onChange={(e) => onChange(i, "nicDob", e.target.value)} />\n'
    '                </Field>\n'
    '              </div>\n'
    '            </div>'
)
new2 = (
    '                  if (d.dob)      onChange(i, "nicDob", d.dob);\n'
    '                  if (d.address)  onChange(i, "nicAddress", d.address);\n'
    '                  if (d.gender && !child.passportGender) onChange(i, "passportGender", d.gender);\n'
    '                  if (d.nationality && !child.passportNationality) onChange(i, "passportNationality", d.nationality);\n'
    '                }}\n'
    '              />\n'
    '            </div>\n'
    '            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">\n'
    '              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">National ID / Driving License Details</p>\n'
    '              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">\n'
    '                <Field label="Full Name">\n'
    '                  <Input value={child.nicFullName} onChange={(e) => onChange(i, "nicFullName", e.target.value)} placeholder="As on ID document" />\n'
    '                </Field>\n'
    '                <Field label="Document ID Number">\n'
    '                  <Input value={child.nicNumber} onChange={(e) => onChange(i, "nicNumber", e.target.value)} placeholder="ID / CNIC Number" />\n'
    '                </Field>\n'
    '                <Field label="Date of Birth">\n'
    '                  <Input type="date" value={child.nicDob} onChange={(e) => onChange(i, "nicDob", e.target.value)} />\n'
    '                </Field>\n'
    '                <Field label="Address on ID">\n'
    '                  <Input value={child.nicAddress} onChange={(e) => onChange(i, "nicAddress", e.target.value)} placeholder="Address as on ID document" />\n'
    '                </Field>\n'
    '              </div>\n'
    '            </div>'
)
count2 = src.count(old2)
print(f"children NIC block found: {count2}x")
src = src.replace(old2, new2)

# ── 3. Accompanying callback + UI (person reference, indent 16sp) ─────────────
old3 = (
    '                  if (d.dob)      onChange(i, "nicDob", d.dob);\n'
    '                  if (d.gender && !person.passportGender) onChange(i, "passportGender", d.gender);\n'
    '                  if (d.nationality && !person.passportNationality) onChange(i, "passportNationality", d.nationality);\n'
    '                }}\n'
    '              />\n'
    '            </div>\n'
    '            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">\n'
    '              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">National ID / Driving License Details</p>\n'
    '              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">\n'
    '                <Field label="Full Name">\n'
    '                  <Input value={person.nicFullName} onChange={(e) => onChange(i, "nicFullName", e.target.value)} placeholder="As on ID document" />\n'
    '                </Field>\n'
    '                <Field label="Document ID Number">\n'
    '                  <Input value={person.nicNumber} onChange={(e) => onChange(i, "nicNumber", e.target.value)} placeholder="ID / CNIC Number" />\n'
    '                </Field>\n'
    '                <Field label="Date of Birth">\n'
    '                  <Input type="date" value={person.nicDob} onChange={(e) => onChange(i, "nicDob", e.target.value)} />\n'
    '                </Field>\n'
    '              </div>\n'
    '            </div>'
)
new3 = (
    '                  if (d.dob)      onChange(i, "nicDob", d.dob);\n'
    '                  if (d.address)  onChange(i, "nicAddress", d.address);\n'
    '                  if (d.gender && !person.passportGender) onChange(i, "passportGender", d.gender);\n'
    '                  if (d.nationality && !person.passportNationality) onChange(i, "passportNationality", d.nationality);\n'
    '                }}\n'
    '              />\n'
    '            </div>\n'
    '            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">\n'
    '              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">National ID / Driving License Details</p>\n'
    '              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">\n'
    '                <Field label="Full Name">\n'
    '                  <Input value={person.nicFullName} onChange={(e) => onChange(i, "nicFullName", e.target.value)} placeholder="As on ID document" />\n'
    '                </Field>\n'
    '                <Field label="Document ID Number">\n'
    '                  <Input value={person.nicNumber} onChange={(e) => onChange(i, "nicNumber", e.target.value)} placeholder="ID / CNIC Number" />\n'
    '                </Field>\n'
    '                <Field label="Date of Birth">\n'
    '                  <Input type="date" value={person.nicDob} onChange={(e) => onChange(i, "nicDob", e.target.value)} />\n'
    '                </Field>\n'
    '                <Field label="Address on ID">\n'
    '                  <Input value={person.nicAddress} onChange={(e) => onChange(i, "nicAddress", e.target.value)} placeholder="Address as on ID document" />\n'
    '                </Field>\n'
    '              </div>\n'
    '            </div>'
)
count3 = src.count(old3)
print(f"accompanying NIC block found: {count3}x")
src = src.replace(old3, new3)

with open(path, "w", encoding="utf-8") as fh:
    fh.write(src)

# Verify
c_addr_no_i  = src.count('onChange("nicAddress"')
c_addr_i     = src.count('onChange(i, "nicAddress"')
c_addr_input = src.count('nicAddress')
print(f"\nnicAddress no-index: {c_addr_no_i} (expect 4: 2 callbacks + 2 inputs for main+spouse)")
print(f"nicAddress indexed:  {c_addr_i} (expect 4: 2 callbacks + 2 inputs for children+accompanying)")
print(f"nicAddress total:    {c_addr_input}")
print("Done.")

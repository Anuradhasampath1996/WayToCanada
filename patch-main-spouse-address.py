"""Patch 3: main+spouse address callback + grid update"""

path = r"c:\Users\anura\Desktop\WayToCanada\WayToCanada\frontend\Public users Dashbord\app\user-dashboard\questionnaire\questionnaire-form.tsx"

with open(path, encoding="utf-8") as fh:
    src = fh.read()

# 1. Add address line to main+spouse callbacks
old_cb = (
    '            if (d.dob)      onChange("nicDob", d.dob);\n'
    '            if (d.gender && !data.passportGender) onChange("passportGender", d.gender);'
)
new_cb = (
    '            if (d.dob)      onChange("nicDob", d.dob);\n'
    '            if (d.address)  onChange("nicAddress", d.address);\n'
    '            if (d.gender && !data.passportGender) onChange("passportGender", d.gender);'
)
count1 = src.count(old_cb)
print(f"main+spouse callback pattern: {count1}x")
src = src.replace(old_cb, new_cb)

# 2. Update NIC grid + add Address input (main+spouse, data reference)
old_ui = (
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
    '        </div>'
)
new_ui = (
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
    '        </div>'
)
count2 = src.count(old_ui)
print(f"main+spouse NIC UI pattern: {count2}x")
src = src.replace(old_ui, new_ui)

with open(path, "w", encoding="utf-8") as fh:
    fh.write(src)

total = src.count("nicAddress")
print(f"nicAddress total occurrences: {total} (expect >=16)")
print("Done.")

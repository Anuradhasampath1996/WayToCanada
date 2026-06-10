#!/usr/bin/env python3
"""
Patch questionnaire-form.tsx:
- Update navigation footer: step 2 last tab → Step 3, step 3 has Submit
- Add Step 3 card render block
"""

FILE = r"frontend\Public users Dashbord\app\user-dashboard\questionnaire\questionnaire-form.tsx"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

# ── Patch 1: Replace the step-2 "Submit" button with "Next – Assessment" ──────
# The file literally contains "Submittingâ€¦" (UTF-8 ellipsis misread as Latin-1)
# We match on the surrounding lines which don't have encoding issues.
OLD_LAST_TAN_BTN = (
    '            ) : (\n'
    '              <Button\n'
    '                onClick={handleTabNext}\n'
    '                disabled={submitting}\n'
    '                className="bg-green-600 hover:bg-green-700 text-white"\n'
    '              >\n'
)

NEW_LAST_TAB_BTN = (
    '            ) : (\n'
    '              <Button onClick={handleTabNext}>\n'
    '                Next \u2013 Assessment\n'
    '                <ChevronRight className="ml-1.5 h-4 w-4" />\n'
    '              </Button>\n'
    '            )}\n'
    '          </>\n'
    '        ) : (\n'
    '          <>\n'
    '            <Button variant="outline" onClick={() => { setStep(2); setActiveTab(tabs.length - 1); }}>\n'
    '              <ChevronLeft className="mr-1.5 h-4 w-4" />\n'
    '              Back to Detailed Profile\n'
    '            </Button>\n'
    '            <Button\n'
    '              onClick={handleFinalSubmit}\n'
    '              disabled={submitting}\n'
    '              className="bg-green-600 hover:bg-green-700 text-white"\n'
    '            >\n'
)

count1 = content.count(OLD_LAST_TAN_BTN)
if count1 == 0:
    print("ERROR: Patch 1 pattern not found.")
    raise SystemExit(1)
print(f"Patch 1: Found {count1} occurrence(s). Replacing...")
content = content.replace(OLD_LAST_TAN_BTN, NEW_LAST_TAB_BTN, 1)

# ── Patch 2: Fix the closing of the old step-2 ") : (" → ") : step === 2 ? (" ─
# Find the navigation step1 check and change the first ") : (" after it
nav_step1_check = '        {step === 1 ? (\n'
pos = content.find(nav_step1_check)
if pos < 0:
    print("ERROR: step === 1 check not found.")
    raise SystemExit(1)

old_else = '        ) : (\n'
pos_else = content.find(old_else, pos)
if pos_else < 0:
    print("ERROR: Could not find ') : (' after step 1 check.")
    raise SystemExit(1)

new_else = '        ) : step === 2 ? (\n'
content = content[:pos_else] + new_else + content[pos_else + len(old_else):]
print("Patch 2: Updated step 2 branch check.")

# ── Patch 3: Insert Step 3 card before the navigation footer ─────────────────
STEP3_CARD = (
    '\n'
    '      {/* \u2500\u2500 STEP 3 \u2500\u2500 */}\n'
    '      {step === 3 && (\n'
    '        <Card>\n'
    '          <CardHeader>\n'
    '            <CardTitle className="text-base">Immigration Assessment</CardTitle>\n'
    '            <CardDescription>\n'
    '              Help your consultant identify the best pathway for you\n'
    '            </CardDescription>\n'
    '          </CardHeader>\n'
    '          <CardContent>\n'
    '            <Step3Form data={formData} onChange={setField3} />\n'
    '          </CardContent>\n'
    '        </Card>\n'
    '      )}\n'
)

# Find the navigation footer div
nav_marker = '      <div className="flex items-center justify-between gap-4 pt-2">\n'
pos_nav = content.find(nav_marker)
if pos_nav < 0:
    print("ERROR: Navigation footer div not found.")
    raise SystemExit(1)

content = content[:pos_nav] + STEP3_CARD + content[pos_nav:]
print("Patch 3: Inserted Step 3 card.")

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("Done. All patches applied.")


with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

# ── Patch 1: Replace Step 2 "Submit" button with "Next – Assessment" ──────────
OLD_SUBMIT_BTN = (
    '            ) : (\n'
    '              <Button\n'
    '                onClick={handleTabNext}\n'
    '                disabled={submitting}\n'
    '                className="bg-green-600 hover:bg-green-700 text-white"\n'
    '              >\n'
    '                {submitting ? (\n'
    '                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Submitting\u2026</>\n'
    '                ) : (\n'
    '                  <><Send className="mr-1.5 h-4 w-4" />Submit Questionnaire</>\n'
    '                )}\n'
    '              </Button>\n'
    '            )}\n'
    '          </>\n'
    '        )}\n'
    '      </div>\n'
    '    </div>\n'
    '  );\n'
    '}'
)

NEW_SUBMIT_BTN = (
    '            ) : (\n'
    '              <Button onClick={handleTabNext}>\n'
    '                Next \u2013 Assessment\n'
    '                <ChevronRight className="ml-1.5 h-4 w-4" />\n'
    '              </Button>\n'
    '            )}\n'
    '          </>\n'
    '        ) : (\n'
    '          <>\n'
    '            <Button variant="outline" onClick={() => { setStep(2); setActiveTab(tabs.length - 1); }}>\n'
    '              <ChevronLeft className="mr-1.5 h-4 w-4" />\n'
    '              Back to Detailed Profile\n'
    '            </Button>\n'
    '            <Button\n'
    '              onClick={handleFinalSubmit}\n'
    '              disabled={submitting}\n'
    '              className="bg-green-600 hover:bg-green-700 text-white"\n'
    '            >\n'
    '              {submitting ? (\n'
    '                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Submitting\u2026</>\n'
    '              ) : (\n'
    '                <><Send className="mr-1.5 h-4 w-4" />Submit Questionnaire</>\n'
    '              )}\n'
    '            </Button>\n'
    '          </>\n'
    '        )}\n'
    '      </div>\n'
    '    </div>\n'
    '  );\n'
    '}'
)

# ── Patch 2: Add Step 3 card before the navigation footer ─────────────────────
# Insert the Step 3 card before the navigation footer comment
STEP3_CARD = (
    '\n'
    '      {/* \u2500\u2500 STEP 3 \u2500\u2500 */}\n'
    '      {step === 3 && (\n'
    '        <Card>\n'
    '          <CardHeader>\n'
    '            <CardTitle className="text-base">Immigration Assessment</CardTitle>\n'
    '            <CardDescription>\n'
    '              Help your consultant identify the best pathway for you\n'
    '            </CardDescription>\n'
    '          </CardHeader>\n'
    '          <CardContent>\n'
    '            <Step3Form data={formData} onChange={setField3} />\n'
    '          </CardContent>\n'
    '        </Card>\n'
    '      )}\n'
)

# Also need to update the step === 1 navigation — change "Next â€" Detailed Profile" to proper text
# Let's find the navigation section and replace "step === 2" branch detection
# First, find where the step 2 branch starts in the navigation
NAV_STEP2_OLD = '        ) : (\n'
NAV_STEP2_NEW = '        ) : step === 2 ? (\n'

# Find the navigation footer anchor (the step === 1 check inside the footer div)
NAV_ANCHOR = '      {/* \u00e2\u20ac\u201c\u00e2\u20ac\u201c Navigation footer \u00e2\u20ac\u201c\u00e2\u20ac\u201c */}'
NAV_ANCHOR_UNICODE = '      {/* \u2500\u2500 Navigation footer \u2500\u2500 */}'

# ── Apply patches ─────────────────────────────────────────────────────────────

# Patch 1: Replace the old Submit button block with new Next/Submit split
count1 = content.count(OLD_SUBMIT_BTN)
if count1 == 0:
    print("ERROR: Patch 1 pattern not found.")
    print("Searching for partial match...")
    # Try to find a smaller unique piece
    partial = '                  <><Send className="mr-1.5 h-4 w-4" />Submit Questionnaire</>'
    print(f"  Partial 'Submit' count: {content.count(partial)}")
    raise SystemExit(1)
print(f"Patch 1: Found {count1} occurrence(s). Replacing...")
content = content.replace(OLD_SUBMIT_BTN, NEW_SUBMIT_BTN, 1)

# Patch 2: Find the navigation footer comment and insert Step 3 card before it
# The footer comment was originally "â"€â"€ Navigation footer â"€â"€" (box-drawing chars)
# After our previous edits it may differ. Let's search for what we know is there:
nav_footer_search = '      {/* \u00e2\u20ac\u201c\u00e2\u20ac\u201c Navigation footer'
if nav_footer_search not in content:
    # Try the unicode version
    nav_footer_search2 = '      {/* \u2500\u2500 Navigation footer'
    if nav_footer_search2 in content:
        nav_footer_search = nav_footer_search2
    else:
        # Try the encoded version from file
        nav_footer_search3 = '{/* \xe2\x94\x80\xe2\x94\x80 Navigation footer'
        if nav_footer_search3 in content:
            nav_footer_search = nav_footer_search3
        else:
            print("ERROR: Navigation footer comment not found.")
            print("Searching for 'Navigation footer' anywhere...")
            idx = content.find('Navigation footer')
            if idx >= 0:
                print(f"  Found at position {idx}: {repr(content[idx-20:idx+50])}")
            raise SystemExit(1)

print(f"Patch 2: Inserting Step 3 card before navigation footer...")
content = content.replace(nav_footer_search, STEP3_CARD + nav_footer_search, 1)

# Patch 3: Change ") : (" (step 2 else) to ") : step === 2 ? (" in the nav footer
# This needs to be done carefully - only the one inside the navigation footer
# Count how many times it appears in the file
# We need the one right after "step === 1 ?"
# Let's find "step === 1 ?" in navigation context and replace the matching ") : ("
# Actually the patch 1 already adds ") : (" → we need to change the outer check

# The structure after patch 1 applied should have:
# {step === 1 ? (
#   ... step 1 buttons ...
# ) : (           ← needs to be: ) : step === 2 ? (
#   ... step 2 tabs buttons ...
# ) : (           ← this is the new step 3 block we added

# Find the navigation footer and change the first ") : (" after "step === 1 ?"
nav_step1_check = '        {step === 1 ? (\n'
if nav_step1_check not in content:
    print("ERROR: step === 1 check not found in navigation.")
    raise SystemExit(1)

# Find position of the navigation step1 check
pos = content.find(nav_step1_check)
# Find the ") : (" that follows
old_else = '        ) : (\n'
pos_else = content.find(old_else, pos)
if pos_else < 0:
    print("ERROR: Could not find ') : (' after step 1 check.")
    raise SystemExit(1)

new_else = '        ) : step === 2 ? (\n'
content = content[:pos_else] + new_else + content[pos_else + len(old_else):]
print("Patch 3: Updated step 2 branch check.")

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("Done. All patches applied.")

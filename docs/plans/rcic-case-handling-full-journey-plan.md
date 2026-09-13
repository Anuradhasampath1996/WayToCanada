# RCICMaster Case-Handling Full Journey — Development Plan

**Status:** Phase 0–6 approved / complete — **Release Candidate Ready**  
**Date:** 2026-09-13  
**Approved:** 2026-09-13  
**Owner:** Consultant dashboard + client portal case flow  
**Rule:** Later phases (2–6) do not start until the previous phase is verified.

This plan compares the **demo script / desired RCIC journey** against **what RCICMaster already does**, then defines the flow we will build. Nothing below is already shipped unless marked **EXISTS**.

**Locked decisions (2026-09-13):** D1–D8 and the Phase 0 snapshot/versioning rules in Section 9 are approved. Do not reopen them during implementation unless the user changes them again.

---

## How to use this file

1. Read **Target journey**, **Current system**, and **Gaps**.
2. Pay special attention to **Calculation → pathway select → auto-assign forms + documents**. That is the core of this plan.
3. Section 9 is the approved decision record.
4. Phase 0–6 verification is saved under `docs/plans/phase0-verification/` through `phase6-verification/`. Final release-readiness is in `docs/plans/final-journey-verification/RELEASE-READINESS.md`.

---

## 1. Target journey (what you described)

This is the complete consultant + client lifecycle you want the product to tell and operate:

```
Client Added
→ Initial Consultation
→ Client Profile Completed
→ Information Reviewed
→ Eligibility Assessment
→ Pathway Recommendations (Maple AI — support only)
→ Consultant Selects Pathway
→ Retainer / Service Agreement
→ Client Reviews and Signs Agreement
→ Representative Authorization (where applicable)
→ Case Activated
→ Pathway-Specific Additional Data Collection
→ Pathway-Specific Document Checklist Generated
→ Documents Requested / Uploaded / Reviewed / Corrected / Verified
→ Application Prepared + Forms Auto-Filled
→ Consultant Final Review
→ Client Final Review + Required Declarations / Signatures
→ Ready to Submit
→ Correct Government / Provincial Portal Selected
→ Application Submitted + Confirmation Recorded
→ Post-Submission Monitoring
→ Government Requests Managed
→ Final Decision Received
→ Client Follow-Up
→ Case Closure Review
→ Case Closed
```

Around this, the public product still includes:

- Public site `rcicmaster.ca` → Sign In / Start Free Trial
- Consultant register + email + RCIC number verification
- Main dashboard (clients, cases, pending docs, ready-to-submit, calendar)
- Side modules: Legislations Hub, Letters, All Clients, Client Requests, Add Client, Application Progress Board, Document Storage, Marketing, RCIC Community

**Product rule you locked in:** RCICMaster is not “upload + chatbot + form fill”. It is a full RCIC case-management platform. AI never makes the final immigration decision. The licensed consultant does.

---

## 2. Current system (what exists today)

Today the product is a **4-step gated workspace**, not the full 30+ stage journey.

### Consultant workspace (4 steps)

| # | Current label | What actually happens |
|---|---------------|------------------------|
| 1 | Intake & pathway | Questionnaire review + CRS/pathway calculator + assign pathway |
| 2 | Retainer | Generate / send / client e-sign agreement |
| 3 | Forms | Client fills assigned interactive IRCC forms; consultant reviews them |
| 4 | Case hub | Documents checklist, government PDF autofill, messages, pipeline |

Unlock rules today:

1. Pathway assigned → retainer unlocks  
2. Agreement signed → interactive forms unlock  
3. All interactive forms submitted **and** consultant-reviewed → Case Hub / client Documents unlock  

If a package has **zero interactive forms**, Case Hub unlocks immediately after the agreement is signed.

### Client portal (4 matching steps)

1. Complete your profile (questionnaire) — always open  
2. Sign agreement — after pathway assigned / agreement sent  
3. Application forms — after agreement signed  
4. Documents — after Case Hub unlock  

### Pipeline statuses that exist today

`PENDING_ASSESSMENT` → `PATHWAY_SELECTED` → `AGREEMENT_SENT` → `AGREEMENT_SIGNED` → `DOCUMENTS_UPLOADING` → `UNDER_REVIEW` → `READY_FOR_SUBMISSION` → `APPLICATION_SUBMITTED`

Lifecycle (separate from pipeline): `active` / `on_hold` / `closed` / `completed`. Multi-case per client already exists.

### What is already real

- Public consultant register / login / Google auth  
- RCIC licence verification (CICC register + email match / signed verify link)  
- Subscription / trial gate  
- Add client + invite email; client self-request + consultant accept  
- Questionnaire + OCR prefill (passport, NIC, licence, education, language, study)  
- Consultant verify / edit / refill-request on questionnaire fields  
- CRS + FSW scoring (Express Entry focused)  
- Pathway catalog assign  
- Maple AI as **advisor** (pathway notes, package pick among candidates, retainer draft, case chat)  
- Auto-assign IRCC application package when pathway is selected  
- Retainer create / send / sign / PDF  
- Interactive forms + consultant review gate  
- Case Hub document checklist (hardcoded by pathway family)  
- Case document upload + AI scan (images) + approve / reject  
- Official PDF autofill for a small set: IMM5476, IMM5406, IMM0008, IMM5562, IMM5669 (production licence still flagged)  
- Document Workshop (merge PDFs)  
- Application Progress Board (post-retainer kanban)  
- Calendar / Google Calendar connect (dashboard)  
- Letters, legislation, storage, marketing, community modules exist as separate tools  

---

## 3. Gap map — desired stage vs today

Legend: **EXISTS** = usable now · **PARTIAL** = exists but too thin / wrong order · **MISSING** = not built

| Desired stage | Today | Gap |
|---------------|-------|-----|
| Public site → Sign In / Trial | EXISTS | Keep. No flow rewrite. |
| Consultant register + RCIC verify | EXISTS | Keep. |
| Main dashboard cards / calendar | PARTIAL | Cards exist. No true “Ready-to-Submit” vs post-submission government-request counts. Calendar is meetings/deadlines, not full case-task board. |
| Add client + invitation | EXISTS | Keep. |
| Initial consultation + structured assessment | PARTIAL | Notes exist on client/profile. There is **no first-class Initial Consultation stage**. **D1 locked:** consultation must NOT block the client questionnaire. Client may complete intake before or after consult. **Initial Consultation + Profile Review must both be done before Select Pathway.** Skip consult only with a recorded reason. |
| Complete Your Profile (questionnaire) | EXISTS | Strong. OCR + refill loop exists. |
| Consultant information review | EXISTS | Verify / refill / verify-all exist. Soft UI nudges only — no hard “profile verified” gate before eligibility. |
| Eligibility assessment (all programs) | PARTIAL | Backend calculates **CRS + FSW** and recommends only **FSW / CEC / FST / PNP**. Study, Work, Family, Visitor, Quebec, Business, Citizenship, PR Card are catalog/heuristic, not full eligibility engines. No medical / criminal / admissibility / funds-threshold / program-cap engine. |
| Maple AI pathway recommendations | PARTIAL | Advisor + package disambiguation. Does **not** write the pathway. Must stay that way. Need structured output: suitable / not suitable / missing requirements / risks / alternatives, stored on the case. |
| Consultant selects pathway + internal notes | PARTIAL | Assign exists. Assessment snapshot + notes exist. Alternative pathways are not a first-class case record. |
| **Auto-assign forms + documents after pathway** | PARTIAL — **this is the biggest product gap** | See Section 4. Package + hardcoded checklist fire, but additional data, IMM5476 timing, and IRCC-accurate checklists are incomplete. |
| Retainer / service agreement | EXISTS | Keep. Maple draft + consultant review + client sign. |
| Representative authorization (IMM5476) as its own stage | PARTIAL | IMM5476 generation lives in Case Hub **after** forms unlock, not as a required pre-activation stage. **D4 locked:** Registry sets `required \| optional \| not_applicable` from representation, application type, and submission process. If the snapshot says `required`, consultant cannot bypass with N/A. |
| Case activated | PARTIAL | “Active” is lifecycle default. Product meaning you described (retainer + representative done → case active → extra data + docs) is not a dedicated status. |
| Pathway-specific additional data collection | MISSING | After pathway, client is **not** asked only for the extra fields that pathway needs. They already filled the big questionnaire. There is no delta questionnaire. |
| Pathway-specific document checklist | PARTIAL | Hardcoded `PATHWAY_REQUIREMENTS` by family (EE, PNP, Family, Study, Work, …). **Not** generated from the assigned IRCC package checklist / client circumstances (spouse, children, job offer, funds, inside/outside Canada). |
| Document verification workflow | PARTIAL | Statuses: pending / AI / approved / rejected. Missing first-class: Requested, Correction Required, Resubmission Requested, Verified as named product states. Package PDFs are a second parallel track. |
| Application preparation + Auto Fill | PARTIAL | Official PDF autofill for 5 forms. Interactive forms are data capture, not IRCC submit. Many package form codes are reference-only. |
| Consultant final review stage | MISSING | No dedicated package-completeness review: names/dates/history/docs/inconsistencies checklist before client declaration. |
| Client final review + declarations | MISSING | **D7 locked:** acknowledgement is required before every final submission (date/time on the audit trail). Signature / declaration only when that application/process requires it. |
| Ready to Submit + portal picker | PARTIAL | Pipeline status exists. No “which portal” (IRCC Rep / PR / provincial) recorded. |
| Submission confirmation fields | MISSING | No application number, confirmation number, fees, receipt, submitted-docs snapshot. `APPLICATION_SUBMITTED` is a label only. |
| Post-submission monitoring | MISSING | No AOR, biometrics, medical, additional docs, interview, PFL, passport request, portal invitation as tasks. |
| Application Progress Board stages you listed | PARTIAL | Board only shows **post-retainer** cases and 5 columns. **D6 locked:** keep the full status model internally. UI is **three groups** (Pre-Engagement / Active Case / Submission), not 21 flat columns. Filters can still show every status. |
| Case history timeline | PARTIAL | Activity logs / messages / some snapshots. Not one structured case history of consult → pathway → retainer → 5476 → docs → submit → gov requests → decision. |
| Decision + follow-up | MISSING | No Approved / Refused / Withdrawn + refusal letter + next-step record. |
| Case closure review | PARTIAL | Lifecycle `closed` / `completed` exists. No closure checklist (final docs, client comms, outstanding tasks/payments, gov requests done). |

---

## 4. Calculation → pathway select → auto-assign (must be crystal clear)

This is the heart of the new flow. Today these three things are **loosely connected**. The plan is to make them **one machine**.

### 4.1 What happens today (exact)

```
Verified questionnaire (soft)
        │
        ▼
CRS / FSW calculator  +  Maple advisor  +  catalog browse
        │
        ▼
Consultant clicks Assign Pathway
        │
        ├─► case.immigration_pathway + pathway_code
        ├─► status = PATHWAY_SELECTED
        ├─► IrccPackageSuggestionService.autoAssignForPathway()
        │       • maps pathway → IRCC category leaf
        │       • if several leaves, Maple or inside/outside-Canada heuristic picks one
        │       • writes assigned_ircc_category_id
        │       • clears application_forms_verified_at
        │
        └─► later, when Case Hub opens:
                • interactive forms = forms attached to that IRCC category
                • document checklist = BASE_REQUIREMENTS + PATHWAY_REQUIREMENTS[family]
                • official PDF form codes = package.forms ∪ pathway family codes ∪ always IMM5476
```

**Problems with today**

1. **Calculation is EE-heavy.** A Study / Work / Family client still walks a CRS tool that is not their real eligibility test.  
2. **Assign is one click.** It does not create a written eligibility decision (suitable / not / risks / alternatives).  
3. **Forms assigned to the client are only interactive forms on the IRCC category.** If the category has no interactive forms, the client never sees a forms step. Official IMM PDFs stay consultant-side.  
4. **Documents assigned to the client are a hardcoded family list**, not the IRCC checklist for that exact program, and not filtered by spouse / children / job offer / funds / inside-outside Canada.  
5. **Extra pathway questions are not generated.** Client is not asked only the missing fields for that pathway.  
6. **IMM5476 is not a pre-activation gate.** It appears in Case Hub with other government forms.  
7. **Two document systems** (hub checklist vs package PDF submit vs questionnaire intake files) are not one client list.

### 4.2 Target machine (what we will build)

```
Profile verified (hard gate)
        │
        ▼
Eligibility Assessment workspace
  • Load verified questionnaire as the only source of truth
  • Run the RIGHT calculators for the case type:
        - Express Entry family  → full CRS + FSW 100 + CEC/FST checks
        - Study                 → DLI / funds / ties / program heuristics + missing docs
        - Work                  → LMIA / exemption / employer / NOC TEER checks
        - Family sponsorship    → relationship + sponsor income / MNI + undertaking
        - PNP / pilots          → EE score + provincial extras
        - Visitor / Citizenship / PR Card / Quebec / Business → dedicated checklists
  • Maple AI reads the same verified facts and returns structured recommendations
  • Consultant records: selected pathway, why, alternatives, risks, internal notes
        │
        ▼
Consultant confirms “Select pathway”
        │
        ▼
SYSTEM AUTO-RUNS (one transaction, consultant can override after)
```

#### Auto-run A — Application package

- Resolve exact IRCC category leaf for the selected pathway (existing matcher + Maple tie-break).  
- Assign package to the case.  
- If mismatch later (pathway changed), re-heal and reset form-verification.

#### Auto-run B — Pathway-specific additional data (NEW)

From a **Pathway Requirement Registry** (see 4.3), compute:

- fields already present in verified questionnaire → **reuse, do not ask again**  
- fields required by this pathway and missing → **open a client “Additional information” task**  
- fields required only if a condition is true (has spouse, has children, has job offer, inside Canada, sponsor is PR, etc.) → **conditional**

Client portal gets a new step or a locked-until-active card: **“Extra details for your pathway”**. Consultant sees the same list and can mark items N/A.

#### Auto-run C — Forms assigned to the client (NEW / tightened)

Three layers, all generated from the registry + assigned package:

| Layer | Who sees it | Examples |
|-------|-------------|----------|
| Interactive forms | Client, after retainer (or after case activation — decision below) | Package-linked online forms |
| Official IRCC PDFs | Consultant prepares; client reviews/signs when required | IMM0008, IMM5669, IMM5406, IMM5476, IMM5562, pathway extras |
| Declarations / representative | Client when the pathway requires it | IMM5476, client declaration, use-of-rep |

Rules:

- Client is **auto-assigned** only the forms required for **this pathway + this family situation**.  
- Forms already completed for a previous package are reset if the pathway/package changes.  
- IMM5476 is always required when the consultant will represent the client (almost all RCIC cases). It becomes its own trackable item, not a hidden Case Hub tab.  
- Auto-fill uses verified profile + intake documents + additional pathway answers. Consultant reviews before anything is treated as final.

#### Auto-run D — Documents assigned to the client (NEW / tightened)

On pathway confirm, generate a **case document plan**:

1. Start from IRCC package checklist (admin-synced documents) **plus** pathway-family base list.  
2. Apply circumstance rules, for example:
   - spouse accompanying → marriage / relationship docs  
   - children → birth certificates  
   - EE / PNP skilled → ECA, language, employment letters, proof of funds (unless CEC-exempt)  
   - study → LOA, SOP, transcripts, funds  
   - work → job offer / LMIA / contract  
   - family PGP → sponsor NOA / MNI, undertaking  
3. Reuse intake uploads (passport, NIC, licence, education, language) as **already uploaded candidates** on matching checklist rows. Consultant still verifies.  
4. Push the plan to the **client portal Documents step** as soon as the stage is unlocked (after retainer + representative, in the new flow).  
5. Each row has status: `requested` → `uploaded` → `under_review` → `correction_required` / `resubmission_requested` → `verified`.

**Client never sees a blank “upload anything” dump as the main UX.** They see a structured checklist for their case.

### 4.3 Pathway Requirement Registry (new source of truth)

One registry (DB + admin-editable later; v1 can be versioned PHP/JSON seeded from current maps) per `pathway_code`:

```
pathway_code
  calculators[]          e.g. crs, fsw, cec, study_funds
  extra_fields[]         field keys not in base questionnaire
  interactive_form_slugs[]
  official_form_codes[]
  document_items[]
      id, label, category
      required_if[]      e.g. has_spouse, has_job_offer, needs_funds, inside_canada
      reuse_from[]       e.g. questionnaire.passportName
  representative         required | optional | not_applicable
  submission_portals[]   ircc_rep, pr_portal, provincial, other
```

**This registry is what makes “select pathway → client automatically gets the right forms and documents” true.**  
Today we have pieces of this in three places (`IrccPackageSuggestionService`, `CaseManagementHubService::PATHWAY_REQUIREMENTS`, `CaseGovernmentFormCodes`). The plan is to **unify them**.

### 4.4 Worked example — Express Entry CEC, married, 1 child

1. Consultant verifies questionnaire (passport, language, work, spouse, child).  
2. Assessment runs CRS + CEC Canadian-work check + FSW. Maple lists CEC as primary, FSW as alternative, notes funds may be exempt.  
3. Consultant selects **CEC**, saves reason + FSW as alternative.  
4. System auto-assigns:
   - Package: Express Entry / CEC leaf  
   - Extra fields: Canadian work employer details if thin; child’s education if accompanying  
   - Forms: interactive package forms + IMM0008 + IMM5669 + IMM5406 + IMM5476  
   - Documents: passport (reuse intake), photos, language (reuse), ECA, employment letters, child’s birth cert, marriage cert, police, medical — **not** proof of funds if CEC exemption rule says N/A  
5. Client does **not** re-type name/DOB/passport. They only get missing extras + the checklist.

### 4.5 Worked example — Study permit, single, outside Canada

1. CRS is shown as optional context, not the main score.  
2. Study eligibility checklist runs (LOA, funds, ties).  
3. Consultant selects Study Permit.  
4. Auto-assign:
   - Package: Study permit leaf  
   - Extra fields: DLI name, program, start date, funds source  
   - Forms: study interactive forms + IMM1294/relevant codes from package + IMM5476  
   - Documents: passport (reuse), LOA, SOP, transcripts, funds, language if required  
5. EE documents (ECA, Express Entry profile) are **not** assigned.

---

## 5. Target product flow we will implement

This is the flow after the plan is built. It keeps what already works and inserts the missing stages **without throwing away** retainer, questionnaire, CRS, Maple, Case Hub, or Document Workshop.

### Stage 0 — Consultant + client enter the system

**Keep as-is.** Public site, register, RCIC verify, subscription, add client / client request, invite, dashboard.

**Small upgrades (recommended):**

- Dashboard cards map to the new stage counts (consult pending, assessment pending, retainer pending, docs pending, ready to submit, government request open).  
- Application Progress Board columns expand to the full stage list (pre-retainer + post-submit), not only 5 post-agreement columns.

### Stage 1 — Initial consultation (NEW, first-class) — D1

Consultant can:

- Send a short consult question set **or** mark “consult done in person / video”  
- Save goals, history, refusals, observations  
- Mark consultation **complete**, or **skip with a recorded reason**

Client: questionnaire / Complete Your Profile stays available immediately. Consult does **not** lock intake.

**Gate for Select Pathway only:** Initial Consultation complete (or skip-with-reason) **and** Profile Review complete. Not a gate for the client filling the profile.

### Stage 2 — Client profile (KEEP)

Complete Your Profile + OCR extraction + client/consultant correction. Unchanged strength.

### Stage 3 — Information reviewed (TIGHTEN)

Add a hard consultant action: **Mark profile reviewed**.

Until then, Eligibility Assessment can be opened in draft but **Select pathway is disabled** if required identity/core fields are unverified (configurable list: name, DOB, passport, education, language, work as applicable).

### Stage 4 — Eligibility assessment + Maple + select pathway (EXPAND)

New Assessment workspace (can live inside today’s pathway calculator page, restructured):

1. Show verified facts only (flag unverified).  
2. Run the correct calculator set from the registry.  
3. Maple returns structured recommendations (not a decision).  
4. Consultant selects pathway, reason, alternatives, risks.  
5. Confirm → **auto-run A–D** (package, extra fields, forms plan, document plan).

### Stage 5 — Retainer (KEEP)

Create → Maple draft → consultant edit → send → client sign. Unchanged.

### Stage 6 — Representative authorization (NEW stage, reuse IMM5476 engine) — D4

Snapshot field: `required` | `optional` | `not_applicable` from the **case requirement plan** (copied from the registry version at pathway confirm). Inputs: representation status, application type, submission process.

- If `required`: consultant **cannot** mark N/A. Track `sent_to_client` → `signed` → `reviewed` → `completed`.  
- If `optional`: consultant may complete or leave unused; no fake N/A when the registry said required.  
- If `not_applicable`: stage is hidden / skipped and recorded as N/A from the plan, not from a consultant override.

Case Activation waits for `completed` only when the snapshot says `required`.

### Stage 7 — Case activated (NEW meaning) — D3

After retainer signed + representative requirement satisfied:

- Case is **Active**
- These may progress **in parallel** (not Forms → Documents):
  - Additional pathway information
  - Application forms
  - Document collection
- Documents must not wait for forms to be finished or reviewed. Document collection can take months.

### Stage 8 — Additional data (NEW)

Client answers only missing pathway fields. Consultant can complete on behalf / request refill (same pattern as questionnaire).

### Stage 9 — Documents (EXPAND existing Case Hub)

Use generated document plan. Statuses as in 4.2 D. Reuse intake files. Consultant comments + resubmit. Document Workshop stays as a merge tool on top of verified files.

### Stage 10 — Application preparation + autofill (EXPAND)

Consultant generates official PDFs from verified data. Expand form coverage over time; v1 keeps current 5 + package interactive forms. Missing official templates stay “reference / upload signed copy”.

### Stage 11 — Consultant final review (NEW)

A checklist page on the assembled package:

- forms complete  
- names / dates consistent  
- work / education / travel / immigration history complete  
- all required documents verified  
- Maple/system highlights possible inconsistencies (support only)

Consultant marks **Ready for client review**.

### Stage 12 — Client final review + declarations (NEW) — D7

Required before every final submission:

- **Acknowledgement** — always. Store who, date, time on the audit history.  
- **Signature / declaration** — only when the application/process in the snapshot requires it.

Consultant cannot complete the client acknowledgement or sign for the client.

### Stage 13 — Ready to submit (EXPAND)

Consultant picks submission method: IRCC Representative Portal / PR Portal / other GoC / provincial. Status `READY_FOR_SUBMISSION`.

### Stage 14 — Submitted (NEW fields)

Record: submission date, application / confirmation number, fees, payment confirmation, receipt file, submitted-docs snapshot. Status `SUBMITTED`.

### Stage 15 — Post-submission (NEW)

Create government-request tasks with deadlines:

- AOR, biometrics, medical, additional documents, interview, PFL, passport request, portal invitation, other  

Client notified in portal. Consultant reviews response, then records that the government request was answered.

Pipeline / board columns for: Government Processing, Government Request Received, Response in Progress.

### Stage 16 — Decision + follow-up (NEW)

`approved` / `refused` / `withdrawn` / other. Attach decision letter. Optional next-step note (new application, alternative pathway, close).

### Stage 17 — Closure review (EXPAND lifecycle)

Checklist: final docs saved, final client message, no open tasks, payments noted, gov requests done, record complete. Then `closed` / `completed`.

---

## 6. Application Progress Board — D6

Keep the **full status model internally**. Do **not** render 21 flat columns.

### Groups (UI)

1. **Pre-Engagement / Assessment** — Initial Consultation, Profile Review, Eligibility Assessment, Pathway Recommended, Pathway Selected, Retainer Pending, Representative Authorization Pending  
2. **Active Case / Application Preparation** — Case Active, Additional Data, Document Collection, Document Review, Application Preparation, Consultant Final Review, Client Review, Ready to Submit  
3. **Submission / Post-Submission** — Submitted, Government Processing, Government Request Received, Response in Progress, Decision Received, Case Closed  

Filters can still isolate any single status. Legacy `case_files.status` values map into this model so live cases do not break. A derived `workflow_status` holds the detailed status when present.

---

## 7. What I recommend adding (beyond your script)

These are extras I believe we should include because they prevent the same bugs you already hit (empty Document Workshop, wrong checklist, skipped 5476).

1. **Single Pathway Requirement Registry** — one place for calculators, extra fields, forms, documents, 5476, portals.  
2. **Reuse intake documents on the checklist** — passport already uploaded in questionnaire should appear as a candidate on the case document row.  
3. **Hard “profile reviewed” gate** before pathway confirm.  
4. **Pathway change = re-generate plans** and show a diff. **D5:** non-destructive — reuse compatible answers/docs; unused items become `not_required` / `obsolete`; history stays.  
5. **Inconsistency engine (support only)** — e.g. questionnaire name ≠ passport OCR; work dates overlap; age vs education. Used in Final Review.  
6. **Submission portal recommended by registry; consultant confirms the final method.** Never auto-submit to IRCC or a provincial portal.  
7. **Government request tasks with due dates** — **D8:** preset types + custom Other.  
8. **Case history timeline** on the workspace (every stage change, who, when, old/new plan versions).  
9. **Do not auto-submit to IRCC.** System prepares; consultant files on the real portal.  
10. **Keep Maple as decision-support only.** Never auto-select pathway, approve information/documents, sign, submit, or make the final eligibility decision.

---

## 8. What we will not do in v1 of this rebuild

- Live IRCC / provincial portal API submit or status scrape  
- Full legal eligibility for every provincial stream and Quebec program (v1 = structured checklists + calculators we already trust + Maple narrative)  
- Replacing retainer, questionnaire, OCR, Document Workshop, letters, legislation, LMS  
- Client-side Document Workshop  
- Auto-activating official IRCC PDF templates without hash/verify (already a separate official-forms sync process)

---

## 9. Approved decisions (locked 2026-09-13)

| ID | Decision |
|----|----------|
| **D1** | Consultation does **not** block the client questionnaire. Intake may happen before or after consult. **Select Pathway** requires Initial Consultation (or skip-with-reason) **and** Profile Review. |
| **D2** | Required identity/core profile fields must be reviewed/verified before Select Pathway is enabled. |
| **D3** | After Case Activation, Additional information, Forms, and Documents progress **in parallel**. Documents are not blocked by forms. |
| **D4** | IMM5476 is **not** hard-coded for every case. The registry/snapshot sets `required \| optional \| not_applicable`. If `required`, consultant cannot bypass via N/A. |
| **D5** | Pathway change regenerates the plan and shows a diff. **Non-destructive:** reuse compatible data; unused items → `not_required` / `obsolete`; keep history of forms, plans, and pathway decisions. |
| **D6** | Full status model internally. UI = three groups, not 21 columns. Filters can show any status. |
| **D7** | Client acknowledgement required before every final submission (date/time). Signature/declaration only when that process requires it. |
| **D8** | Preset government-request types + custom **Other**. |

### Phase 0 rules (also locked)

1. **Version the registry** — each definition has `version`, `effective_from`, `effective_to`, source/reference, `last_verified_at`. Active cases must not read a mutable live row as their live checklist.  
2. **Snapshot `case_requirement_plan`** on pathway confirm — extra fields, forms, documents, representative, portal options, registry version. Later registry edits do not silently change an active case.  
3. **Registry updates use a diff** — added / removed / changed forms / changed documents. Consultant explicitly applies the update.  
4. **Pathway changes preserve history** — old/new pathway, consultant, reason, timestamp, old/new plan versions. Do not destroy collected information.  
5. **Portal** — registry recommends; consultant confirms the final portal/method. No automatic IRCC/provincial submit.  
6. **Maple AI** — decision support only. Never select pathway, approve info/docs, sign, submit, or make the final eligibility decision.

---

## 10. Build order (starts only after you approve)

Development will be phased so each phase is shippable. No big-bang rewrite of the 4-step shell in one PR.

### Phase 0 — Registry + status foundation (approved / complete 2026-09-13)

- Versioned Pathway Requirement Registry (seed from current package maps + `PATHWAY_REQUIREMENTS` + government form codes)  
- `case_requirement_plan` snapshot on pathway confirm  
- Registry-update diff + explicit apply  
- Pathway-change history (non-destructive)  
- Internal workflow status model + legacy status mapping + three UI groups  
- Case history event log  
- Recommended portals on the plan; no auto-submit  
- Maple AI boundary helper (no auto-decision)

**Verified:** Selecting a pathway writes a versioned `case_requirement_plan` without breaking old cases; changing pathway snapshots a new plan and keeps the old one; a newer registry version can be diffed and applied only on consultant confirm. Clearing a pathway does not delete previous plans. Portal confirm records the method and does not submit to IRCC.

### Phase 1 — Assessment completeness (calculation + select) (approved / complete 2026-09-13)

Shipped and browser-smoked (`docs/plans/phase1-verification/`, 15/15):

- Hard **profile-reviewed** gate (D2) + required identity/core fields  
- **Consultation complete or skip-with-reason** before Select Pathway (D1; intake stays unblocked)  
- Calculator routing by pathway family (EE = CRS tools; others = checklist + heuristics)  
- Structured Maple recommendation stored on the case (decision support only; never auto-selects)  
- Consultant Select Pathway requires **reason**, plus optional alternatives/risks  
- Plan snapshot still auto-generates on confirm (Phase 0)

**Verified blocked states:** consultation incomplete with no skip reason; profile not reviewed; missing required core fields; pathway selection without a reason.

### Phase 2 — Auto-assign to the client (approved / complete 2026-09-13)

Shipped in this pass:

- Pathway confirm applies questionnaire facts (`has_spouse`, `has_children`, `needs_funds`, …) and snapshots extra fields / forms / documents  
- Client is asked **only missing** pathway fields; intake/profile values are marked `reused`  
- Intake uploads (passport, language, education) attach as `reuse_candidate` on matching checklist rows  
- Form plan = registry official codes + assigned package interactive forms  
- Document checklist prefers the case requirement plan over the old hardcoded family list  
- After retainer signed, extra data / forms / documents can progress **in parallel** (D3) when a plan exists  
- Pathway change merges compatible answers/docs and moves unused items to `obsolete` (D5; no destructive delete)

**Verified browser smoke** (`docs/plans/phase2-verification/`, 7/7): Study vs EE checklists do not leak each other's items; intake passport/language/education appear as reuse candidates; pathway change keeps prior plans and marks leftover items `obsolete` / `not_required`.

### Phase 3 — Representative + activation + document statuses (approved / complete 2026-09-13)

Shipped in this pass:

- IMM5476 track is driven by the case snapshot (`required` / `optional` / `not_applicable`) — no global hard-code (D4)  
- Required: `pending → sent_to_client → signed → reviewed → completed`; N/A is rejected  
- Optional: may complete or leave unused; case can activate after retainer  
- `not_applicable`: stage hidden / skipped from the plan  
- Case activates only after retainer signed **and** the representative requirement is satisfied  
- Document workflow: requested / uploaded / under review / correction required / resubmission requested / verified  
- Application Progress Board returns **3 groups** plus a filter for any internal status (D6)

**Done when:** A signed retainer + completed 5476 (or N/A) activates the case and the board shows the new columns.

**Verified smoke** (`docs/plans/phase3-verification/`, 7/7): required IMM5476 incomplete stays inactive; required complete activates; optional unused activates; `not_applicable` is hidden and activates; documents can reach `verified`; legacy approve/reject still map; Progress Board groups + status filter do not duplicate or lose cases.

### Phase 4 — Final review → submit confirmation (approved / complete 2026-09-13)

- Consultant final review checklist + inconsistency highlights (support only, never automatic approval)
- Consultant marks Ready for Client Review
- Client read-only final package review
- Client acknowledgement required for every final submission
- Signature/declaration only when the snapshot requires it
- Consultant cannot acknowledge or sign for the client
- Consultant confirms the submission portal/method (no IRCC/provincial auto-submit)
- Ready to Submit, then Submitted with confirmation fields and an immutable history event

**Done when:** A case can be marked Submitted with application number and receipt stored.

**Verified browser smoke** (`docs/plans/phase4-verification/`, 28/28): consultant Final Review checklist and advisory highlights; incomplete checklist blocked; Ready for Client Review writes `CLIENT_REVIEW` + history; client package is read-only; acknowledgement writes timestamp/IP/UA; signature required only when the snapshot says so; consultant ack/sign endpoints return 403; portal confirm is required and `auto_submitted` stays false; document approval alone does not set Ready to Submit; submission fields + immutable `application_submitted` event; legacy ready/submitted cases still open; refresh does not duplicate history.

### Phase 5 — Post-submission → close (approved / complete 2026-09-13)

- Government request tasks (AOR, biometrics, medical, additional documents, interview, PFL, passport request, portal invitation, Other)  
- Client portal notification + read-only `/user-dashboard/government-requests`  
- Consultant calendar due dates  
- Decision statuses + optional letter (recorded once, not overwritten)  
- Closure review checklist, then `closed` / `completed`  
- History preserved; decision / close / government-request events are immutable  

**Done when:** A submitted case can take a biometrics/PFL-style request, record a decision, and close with a checklist.

**Verified browser smoke** (`docs/plans/phase5-verification/`, 31/31): pre-submission blocked; all request types including Other label; due dates on calendar; request lifecycle + no duplicate answered history; client page locked then read-only; notification written; decision + letter + overwrite blocked; closure gates; legacy submitted still accepts a request; board groups update through Government Processing → Closed.

### Phase 6 — Dashboard polish (approved / complete 2026-09-13)

- Home cards: In Preparation, Needs Attention, Government Processing — each card opens the matching filtered board  
- Pending Actions: case/client, required action, responsible side, due date, overdue, current journey stage  
- Needs Attention is action-based only (overdue client/government request, document correction, consultant review, client final review, open government request, blocked consultant action). Quiet government-processing cases are not counted  
- Consultant workspace rail: 5 grouped stages with detailed status as secondary text  
- Client journey: 5 friendly stages, no internal status codes  
- Progress Board stays in 3 groups; cards show client, pathway, detailed status, next action, due/overdue, government-request indicator; closed cases visually separated  
- Shared workflow labels across dashboard, workspace, board, client portal, calendar, and notifications  

**Done when:** Presentation-only polish is consistent and no Phase 1–5 gates changed.

**Verified browser smoke** (`docs/plans/phase6-verification/`, 17/17): dashboard counts match filtered lists; cards open the correct view; Pending Actions show actor/due; overdue government requests need attention; quiet submitted cases do not; 5-stage consultant rail; client 5-stage journey with no leaked codes; board keeps 3 groups and unique cases; calendar government-request deadlines link to the case; notifications open the client government-requests page; mobile dashboard usable. Phase 3–5 workflow tests still pass (10/10).

---

## 11. Success criteria (do not ship the “new flow” without these)

1. A consultant can take a **new client from invite → closed** without leaving RCICMaster except the real government portal at submit time.  
2. After pathway select, the **client automatically receives** only that pathway’s extra questions, forms, and documents.  
3. Intake passport/ID/education/language files **appear on the matching checklist rows**.  
4. Maple never assigns a pathway, approves information/documents, signs, submits, or makes the final eligibility decision.  
5. IMM5476 is its own track only when the **case snapshot** says `required` (not a global hard-code).  
6. `APPLICATION_SUBMITTED` is never an empty label — confirmation fields exist.  
7. Old live cases keep working (status mapping + existing retainers/forms/docs).  
8. Document Workshop still opens every client upload (intake + case + package).

---

## 12. Approval record

**Approved with changes** on 2026-09-13. Decisions in Section 9 are locked.

Phase 0–6 are verified. **RCIC Case-Handling Full Journey — Release Candidate Ready** (`docs/plans/final-journey-verification/RELEASE-READINESS.md`).

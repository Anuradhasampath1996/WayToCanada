# Named Multi-Case Auto-Hold Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Let consultants create named new cases for a client anytime; auto-hold previous active cases; client portal keeps showing only the focused case; questionnaire stays shared.

**Architecture:** Extend `CaseFileLifecycleService` (create/openNew/resume/meta/summary) + migration `case_files.name` + consultant Case lifecycle panel dialog. Client side already uses `active_case_file_id`.

**Tech Stack:** Laravel 12, PostgreSQL `cws`, Next.js Consultant Dashboard

## Global Constraints

- Do not break existing single-case clients (nullable name → display fallback `Case #N`)
- Questionnaire remains per `user_id`
- Auto-hold only targets `lifecycle_status = active`

---

### Task 1: Migration + model

- [ ] Add migration `case_files.name` nullable string(120)
- [ ] Add `name` to `CaseFile` `$fillable`

### Task 2: Lifecycle service

- [ ] `createCase($profile, $consultantId, ?string $name = null, ?string $note = null)`
- [ ] `holdAllActiveExcept($profile, ?int $exceptCaseId)` helper
- [ ] `openNewCase`: validate name; hold all active; create; no close/complete gate
- [ ] `resume`: hold other actives; then resume
- [ ] `lifecycleMeta.can_open_new_case` = true always (for owned profile)
- [ ] `formatCaseSummary`: include `name`, `label` = name or `Case #N`

### Task 3: Controller

- [ ] `openNewCase` validate `name` required|string|max:120, optional note

### Task 4: Consultant UI

- [ ] New-case dialog (name + optional note)
- [ ] Show Open new case whenever meta allows (always)
- [ ] Switcher labels use `c.label` / name

### Task 5: Smoke check

- [ ] First case still auto-creates on workspace open
- [ ] Second case holds first; client API returns new active case

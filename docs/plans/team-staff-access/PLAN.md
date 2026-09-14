# Consultant Team & Staff Access

**Status:** decisions locked 2026-09-14 — implementation in approved phase order.  
**Date:** 2026-09-14  
**Scope:** invite staff into a consultant’s practice workspace, customizable permissions, case access scopes, backend enforcement, Team Management UI.  
**Out of scope until a later approved plan:** production deploy, `migrate:fresh`, multi-RCIC firm ownership transfer, automatic seat billing, staff access to referral/wallet, staff performing licensed RCIC final decisions, rewriting RCIC case-handling Phase 0–6 workflow (permission guards only).

This plan is based on inspection of the current codebase. There is **no** firm, organization, staff, or team-membership module today.

---

## Product goal (locked by this request)

A licensed consultant (workspace owner) invites staff who work for their immigration business.

Each staff member has a **separate account** (own email, password, session, audit identity). They never share the consultant’s login.

The consultant chooses a **role preset** (starting template only), then turns individual permissions ON/OFF before sending the invitation. Final access is the saved permission set + access scope + tenant membership — not the preset name.

Staff work inside the **existing Consultant Dashboard** with permission-aware navigation. They must never impersonate the licensed RCIC for protected case-journey actions, and must never see another consultant’s data.

---

## Implementation gate

1. Approve or rewrite the **Recommended locked decisions** and **Open decisions** below.
2. Then implement Phase 0 → 9 in order.
3. No production deploy from this plan.
4. No `migrate:fresh` on product/production `db_cws`.
5. Do not modify Phase 0–6 case-handling workflow or the frozen tag `rc-case-handling-phase-0-6` except additive authorization wrappers.
6. Do not break hardened platform billing, referral/wallet, client portal, or admin dashboard.

Do **not** start Phase 1 until this plan is approved.

---

## 0. Current architecture findings

### 0.1 Authentication

| Item | Finding |
|------|---------|
| Identity | Single `users` table (`cws`). Spatie `HasRoles` + Sanctum `HasApiTokens`. |
| Login | One `POST /api/v1/auth/login` for all portals. Role is **not** checked on login. Frontends reject the wrong role after token issue. |
| Tokens | `personal_access_tokens` on `cws`. Named `password-auth` / `google-auth` / `github-auth`. Sanctum `expiration` is null. |
| Email verify | Signed URLs exist. **No `verified` middleware** on workspace APIs. Register returns a token immediately. |
| License | `users.is_license_verified` via `ConsultantOnboardingController`. **UI-only** (`OnboardingGuard`). API does not block unverified RCICs. |
| Subscription | `GET /consultant/subscription` is per `user_id`. **UI-only** (`SubscriptionGuard`). Workspace APIs do not check subscription. |
| MFA | **Does not exist.** |
| Client invite | `ClientController` emails a **plaintext generated password**. Do **not** copy this for staff. |
| Token revoke | Client deactivate already deletes Sanctum tokens (`toggleStatus`). Reuse that pattern for staff suspend. |

Portal split today:

| Portal | Allowed roles |
|--------|----------------|
| Consultant Website / Consultant Dashboard | `rcic` (admin redirected away on marketing login) |
| Public / client | `client` |
| Admin | `admin`, `super-admin` |

Consultant dashboard `proxy.ts` only checks that `wtc_consultant_token` exists — not role.

### 0.2 Roles

`RolesAndPermissionsSeeder` creates only:

`super-admin`, `admin`, `rcic`, `client` (guard `sanctum`).

**No Spatie permissions are seeded or used.** `config/permission.php` has `teams => false`. Authorization is role middleware (`EnsureHasRole`) plus inline `$profile->consultant_id === $request->user()->id`.

**Zero Laravel Policy classes.**

`role:rcic,super-admin,admin` is applied to **billing, Stripe, referral/wallet, trial**. Most client/case workspace routes are **`auth:sanctum` only**.

### 0.3 User / firm identity

Firm branding lives on the **RCIC `users` row** (`company_*`, `digital_signature`). There is no organization table.

`users.consultant_id` means “this **client** user’s current practice link”, not an employer. Staff must **not** reuse that column as employer id (collision with client portal).

### 0.4 Consultant–client ownership

| Table | Ownership |
|-------|-----------|
| `client_profiles` | `consultant_id` = owning RCIC `users.id`. Unique `(user_id, consultant_id)` (multi-consultant clients). |
| `case_files` | `consultant_id` + `client_profile_id`. `client_profiles.active_case_file_id` is workspace context. |
| List APIs | `ClientProfile::forConsultant($authUser->id)` |

`ClientController::authorizeConsultant()`:

```php
if ($profile->consultant_id !== $request->user()->id) {
    abort(403, 'Unauthorized.');
}
```

The same equality check is repeated across case, document, form, questionnaire, messaging, and Phase 0–6 controllers.

**Implication:** a staff user with their own `users.id` is **already 403 on every client/case API**. Staff access requires replacing this check with workspace + permission + scope — not assigning staff the `rcic` role.

### 0.5 Case journey (Phase 0–6) — consultant-only vs preparable

Maple (`MapleAiBoundaries`) already forbids AI from: final pathway, approve information, approve documents, sign, submit, final eligibility.

| Protected (licensed RCIC / owner only) | Endpoint (representative) |
|----------------------------------------|---------------------------|
| Mark profile reviewed (D2) | `POST …/case-file/profile-review` |
| Confirm pathway | `PATCH …/case-file/select-pathway` |
| Questionnaire field verify / verify-all | `PATCH …/questionnaire/verify*` |
| Document review verify/approve/reject | `PATCH …/documents/review` |
| Interactive form mark reviewed / verify field | `…/interactive-forms/review*` |
| Government PDF generate + mark reviewed | `…/government-forms/generate`, `markReviewed` |
| Representative send / review / complete | `…/representative/transition` |
| Registry update apply | `…/requirement-plan/apply-registry-update` |
| Confirm submission portal | `…/requirement-plan/confirm-portal` |
| Ready for client / ready to submit | `…/final-review/ready-for-client`, `ready-to-submit` |
| Record submission | `POST …/case-file/submission` |
| Post-submission decision / close case | `…/decision`, `…/closure/close` |
| Lifecycle close/complete | `PATCH …/case-file/lifecycle` |
| Send retainer | existing agreement send |
| Owner subscription / plan / portal / cancel | `consultant/billing/*`, `consultant/subscription/*` |
| Referral / wallet / withdrawal | `consultant/referral*`, `consultant/wallet*`, `consultant/withdrawals*` |
| Use owner `digital_signature` | any sign-as-consultant |

| Client-only (never staff, never consultant-for-client) | Endpoint |
|--------------------------------------------------------|----------|
| Client representative sign | `client.representative.sign` |
| Client final ack / declaration | `client.final-review.acknowledge`, `sign` |
| Public agreement sign | case-file public sign routes |

| Reasonable staff-preparable (if permitted + scoped) | Endpoint |
|-----------------------------------------------------|----------|
| Consultation complete/skip notes | `…/consultation/*` |
| Maple recommend (support only) | `…/maple-recommendation` |
| Pathway assessment notes | `…/pathway-assessment` |
| Plan preview / suggested package | preview / suggested-application-package |
| Questionnaire edit / refill request | questionnaire update / request-refill |
| Gap fill / request unanswered | government-forms fillGap / requestUnanswered |
| Document workshop, checklist tracking | workshop + `updateChecklist` |
| Draft final/closure checklists | `saveChecklist` (not mark ready) |
| Messaging, meetings, activity read | existing consultant client APIs |

Do **not** change the journey steps. Only wrap who may call them.

### 0.6 Documents, forms, assessments, pathway, submission

Already implemented under `/api/v1/consultant/clients/{profile}/…`. Staff work is a **permission overlay**, not a new case engine.

Client delete (`DELETE consultant/clients/{profile}`) **destroys** the profile and may delete the user. That is **not** a safe archive. v1 staff must not receive this. Owner-only.

### 0.7 Billing / subscription

One live platform Stripe `sub_…` per **consultant user**. Packages have JSON `features` but **no seat columns**. Complimentary subscribe is admin-only.

Staff must inherit **owner workspace entitlement** (if the owner’s subscription/trial/grace is active, staff may work). Staff must not open Billing Portal, change plan, cancel, or start Checkout as themselves.

### 0.8 Referral / wallet

Separate ledger on the **referrer consultant user**. Routes already `role:rcic`. Staff must have **no** `rcic` role, so those APIs already 403. Still hide nav and add an explicit deny in the team authorizer. Never expose balances, bank details, or withdrawals.

### 0.9 Notifications

`NotificationType` + `NotificationService` + `dedupe_key`. New team types must be added to every exhaustive `match` in the enum (same lesson as referral). `EmailTemplateRegistry` has a `default` sample.

### 0.10 Audit / history

| Table | Use |
|-------|-----|
| `case_history_events` | Journey timeline (`actor` is typically the owning consultant today). Staff actions that **prepare** work should record the **real staff user id**. |
| `client_activity_logs` | Consultant–client activity. Same: stamp real actor. |
| `referral_audit_events` | Referral only — **do not reuse**. |
| None | Team invite / permission / assignment audit. New `team_audit_events`. |

### 0.11 Consultant dashboard nav

Groups: Overview, Client Work, Marketing (Marketing Services + Referrals & Wallet), Community. Team Management should be a **new owner-only item** (recommend Client Work or a Practice group — open).

### 0.12 Gaps / risks

1. **No workspace/staff tables.** Greenfield membership.
2. **`authorizeConsultant` is user-id equality** in many files. Centralize or staff will stay locked out / or worse, someone assigns `rcic` and bypasses isolation.
3. **Do not give staff role `rcic`.** That would open billing + wallet routes.
4. **Spatie teams are off.** Do not turn them on mid-flight; use custom membership permissions.
5. **Subscription/license are UI-only.** Staff must skip RCIC onboarding. SubscriptionGuard must resolve **owner** subscription.
6. **Client invite emails passwords.** Staff invites must be hashed single-use tokens.
7. **No MFA** to enforce.
8. **Seat limits do not exist.** Do not invent paid seat charges in v1.
9. **`users.consultant_id` is for clients.** Staff employer link belongs on membership, not that column.
10. **Case history may currently assume actor = owner.** Additive actor metadata only; do not rewrite history schema destructively.

---

## 1. Recommended workspace model (v1)

**Introduce a thin workspace layer now.** Do not implement multi-RCIC firms in v1.

Why not `consultant_id → employee_id` only:

- Blocks a second licensed RCIC in the same firm later.
- Mixes with `users.consultant_id` (client portal).
- Makes seat limits and billing attach to a person instead of a practice.

Why not a full rewrite:

- One workspace per existing RCIC is enough.
- `client_profiles.consultant_id` stays the **owner RCIC user id** (no backfill of every case).
- Workspace is resolved as `workspaces.owner_user_id = client_profiles.consultant_id`.

```
consultant_workspaces          (1 per owner RCIC in v1)
  owner_user_id → users.id     unique
  → consultant_workspace_members
  → consultant_workspace_invitations
  → team_audit_events

users (staff) ──< membership >── workspace ── owner users (rcic)
case_files.consultant_id remains owner RCIC
case_team_assignments link membership ↔ case_file
```

v1: only the owner is a licensed `rcic` in that workspace. Additional RCICs = later plan.

---

## 2. Identity and Spatie role

| Actor | Spatie role | Notes |
|-------|-------------|--------|
| Owner consultant | `rcic` | Unchanged. Full implicit workspace access. |
| Staff | **`staff`** (new) | Consultant dashboard login only. Fine-grained access is **membership permissions**, not Spatie permissions. |
| Client | `client` | Unchanged. |
| Admin | `admin` / `super-admin` | Unchanged. No implicit staff access into a firm. |

Do **not** attach Spatie permissions to `staff` for case keys. Those are tenant-scoped and would fight `teams => false`.

Login frontends (Consultant Website + Consultant Dashboard) must accept `rcic` **or** `staff`. Client and admin portals must reject `staff`.

---

## 3. Exact schema (additive, `cws`)

### `consultant_workspaces`

| Column | Notes |
|--------|-------|
| `id` | PK |
| `owner_user_id` | unique FK `users`, cascade restricted |
| `name` | default owner company name or owner name |
| `seat_limit_override` | nullable int — unused until billing decision |
| timestamps | |

Lazy-create on first Team page load or first invite (same pattern as referral codes).

### `consultant_workspace_members`

| Column | Notes |
|--------|-------|
| `id` | PK |
| `workspace_id` | FK |
| `user_id` | FK `users` |
| `invited_by` | FK `users` nullable |
| `job_title` | string nullable |
| `preset_key` | string nullable (`case_manager`, …) — label only |
| `access_scope` | `all_cases` / `assigned_cases` / `selected_cases` |
| `allowed_case_file_ids` | JSON int[] — used when selected |
| `allowed_client_profile_ids` | JSON int[] — optional convenience; selected cases imply their clients |
| `status` | `active` / `suspended` / `deactivated` / `removed` |
| `last_login_at` | nullable |
| `deactivated_at` | nullable |
| unique `(workspace_id, user_id)` | |
| timestamps | |

Owner is **not** required as a member row. Owner access is `owner_user_id === auth id`.

### `consultant_workspace_member_permissions`

| Column | Notes |
|--------|-------|
| `id` | PK |
| `member_id` | FK unique (one set per member) |
| `permissions` | JSON object `{ "clients.view": true, ... }` |
| timestamps | |

Alternatively a child table of `(member_id, permission_key, allowed)`. JSON is enough for v1 and easier to snapshot in audit.

### `consultant_workspace_invitations`

| Column | Notes |
|--------|-------|
| `id` | PK |
| `workspace_id` | FK |
| `email` | |
| `name` | |
| `job_title` | |
| `preset_key` | |
| `access_scope` | |
| `allowed_case_file_ids` | JSON |
| `permissions_snapshot` | JSON — frozen at invite time; copied to membership on accept |
| `token_hash` | unique, SHA-256 of raw token (store hash only) |
| `expires_at` | default 7 days |
| `accepted_at` | nullable |
| `revoked_at` | nullable |
| `invited_by` | FK |
| `accepted_user_id` | FK nullable |
| timestamps | |

Raw token appears **once** in the email link. Token is not the user id.

### `team_permission_presets`

System rows (seeded, not consultant-editable in v1):

`key`, `name`, `description`, `permissions` JSON.

Consultant custom presets can be a later column `workspace_id` nullable.

### `case_team_assignments`

| Column | Notes |
|--------|-------|
| `id` | PK |
| `case_file_id` | FK |
| `member_id` | FK membership |
| `assignment_role` | `primary_case_manager` / `collaborator` |
| `assigned_by` | FK users |
| unique `(case_file_id, member_id)` | |
| timestamps | |

At most one `primary_case_manager` per case (partial unique or application rule).

Owner consultant is always implicit on the case (`case_files.consultant_id`).

### `team_audit_events`

Same shape as `referral_audit_events`: `actor_user_id`, `workspace_id`, `action`, `subject_type`, `subject_id`, `before`, `after`, `ip`, timestamps. **Never update/delete rows.**

### Users table

**No unique index on email change.** Existing email unique stays.

Optional additive: `users.last_login_at` if not present (or store only on membership).

Do **not** put `workspace_id` on `users` (a person might later join two firms).

### Do not add

- Unique index on `users.rcic_number` (already deferred in referral plan).
- Spatie `teams` enablement.
- Staff rows in `consultant_subscriptions`.

---

## 4. Invitation lifecycle

```
draft (in memory) → sent → accepted
                 ↘ expired
                 ↘ revoked
                 ↘ cancelled
```

1. Owner (and only owner in v1) `POST` invitation with name, email, title, preset, custom permissions, scope.
2. Backend strips any **consultant-only** keys from the snapshot.
3. Create invitation + hashed token. Email signed/public URL:  
   `https://rcicmaster.ca/team/invite/{token}` (Consultant Website — same host as register).
4. Accept page: if email already has `staff`/`rcic`/`admin`/`client`, follow **open decision O8**. Recommended: if unused email → set password + verify email + create `staff` user + membership. If email already `staff` in **another** workspace → allow second membership (future). If email is `rcic` or `client` or `admin` → **reject** (do not merge identities in v1).
5. Token single-use (`accepted_at` set). Expired / revoked → 410.
6. Resend: new token hash, old token invalid, new expiry.
7. Cancel: `revoked_at`.
8. Rate-limit invites per owner (e.g. 10/hour). Generic responses (no “email already on this team” enumeration on public accept if avoidable — authenticated accept can be explicit).

**Do not** email a temporary password.

---

## 5. Member lifecycle

`invited` (invitation row only) → `active` → `suspended` / `deactivated` → `reactivated` (`active`) → `removed` (membership kept, `status=removed`, no login to that workspace).

| Status | API access |
|--------|------------|
| active | Yes, if owner subscription/trial/grace allows workspace |
| suspended / deactivated / removed | 403; tokens for that user **revoked** |
| invitation expired | No membership |

Deactivate/reactivate keep permission JSON (reactivate = same saved access).

`removed` does not delete the `users` row or audit identity.

---

## 6. Role presets (templates only)

Seeded keys (consultant can still customize every box):

| Preset | Intent |
|--------|--------|
| `case_manager` | Broad case ops except consultant-only finals |
| `case_worker` | Day-to-day assigned-case work |
| `assistant` | Notes, tasks, calendar, comms; limited edits |
| `document_specialist` | Documents + forms prepare; no billing/team |
| `billing_staff` | **Empty / billing.view only if O4 allows** — default **no** platform billing |
| `read_only` | View-only on scoped cases |

Preset never overrides a later custom save. Stored `preset_key` is a label.

---

## 7. Permission list (v1)

Explicit keys. Unknown keys ignored. Consultant-only keys **cannot be stored** on a member (stripped + UI disabled).

### Assignable

| Group | Keys |
|-------|------|
| Dashboard | `dashboard.view` |
| Clients | `clients.view`, `clients.create`, `clients.edit`, `clients.notes` |
| Cases | `cases.view`, `cases.create`, `cases.edit`, `cases.notes`, `cases.tasks`, `cases.assign` (assign **other staff**, not transfer ownership), `cases.status_update` (non-close workflow helpers only) |
| Documents | `documents.view`, `documents.request`, `documents.upload`, `documents.request_correction` |
| Forms | `forms.view`, `forms.prepare`, `forms.edit` |
| Assessments | `assessments.view`, `assessments.prepare` |
| Pathways | `pathways.view`, `pathways.recommend` |
| Application | `application.prepare`, `application.review` (draft/checklist only) |
| Submission | `submission.view` |
| Calendar / tasks | `calendar.view`, `calendar.manage`, `tasks.view`, `tasks.create`, `tasks.edit` |
| Communication | `communications.view`, `communications.send` |
| Team | `team.view` (own roster read-only). **No** `team.manage` in v1. |
| Extra modules (recommend default OFF) | `letters.use`, `legislations.view`, `community.view`, `storage.view`, `storage.manage`, `marketing.view`, `lms.view` |

### Not assignable (consultant-only — hard deny)

See §8. Also:

- `clients.archive` mapped to **destroy** — owner only. Optional later: map `clients.archive` to `toggleStatus` only (open O5).
- `cases.close` — owner only (lifecycle close / post-submission close).
- `documents.verify` / document **approve** / **reject as official verify** — owner only (Maple `approve_documents`).
- `forms.review` (mark reviewed / verify field) — owner only.
- `pathways.confirm` — owner only (`selectPathway`).
- `assessments.approve` — owner only (`reviewProfile` + questionnaire verify).
- `application.signoff` / `submission.authorize` — owner only.
- `billing.manage`, `subscription.manage`, `referral.*`, `wallet.*`, `team.manage`, `workspace.transfer`.

`billing.view` — **default off**; not in any preset until O4.

---

## 8. Consultant-only / authorized RCIC action matrix

Staff may prepare. Owner must perform. Backend `TeamAuthorizer::requireOwner($workspace)` (or `requireLicensedOwner`).

| Action | Current hook | Staff |
|--------|----------------|-------|
| Final profile / information approval | `reviewProfile`, questionnaire `verify*` | No |
| Final pathway confirmation | `selectPathway` | No |
| Maple recommend | `maple-recommendation` | Yes if `pathways.recommend` |
| Document official verify/approve | `documents.review` verify/approve/reject | No |
| Request documents / upload workshop | checklist / workshop | Yes if documents.* |
| Form official review | interactive `review`, gov `markReviewed` / `generate` | No |
| Form prepare / gap fill | fillGap, request unanswered | Yes if forms.prepare |
| Representative send/review/complete | representative transition | No |
| Client ack/sign (any actor except client) | client final-review / representative sign | No (already 403 for consultant) |
| Ready for client / ready to submit | `markReadyForClient`, `markReadyToSubmit` | No |
| Confirm portal / record submission | `confirmPortal`, `recordSubmission` | No |
| Decision / close case | post-submission + lifecycle | No |
| Send retainer | agreement send | No |
| Use owner digital signature | signature fields | No |
| Platform subscription / plan / portal / cancel | billing + subscribe | No |
| Referral link, wallet, withdrawal | referral/wallet APIs | No |
| Invite/edit/deactivate staff | team APIs | No |
| Transfer workspace ownership | — | Not in v1 |

Maple remains decision support only. Staff using Maple still cannot confirm pathway.

---

## 9. Access scopes

Every resource check is:

**active membership (or owner) + permission + scope + tenant (workspace owns `consultant_id`)**.

| Scope | Meaning |
|-------|---------|
| `all_cases` | All `client_profiles` / `case_files` where `consultant_id = workspace.owner_user_id` |
| `assigned_cases` | Cases in `case_team_assignments` for this membership (+ their client profiles) |
| `selected_cases` | Intersection of assignment **or** `allowed_case_file_ids` (recommend: selected list **is** the allow-list; assignments can add) |

**Recommended lock for selected:** allow-list = `allowed_case_file_ids` ∪ assigned cases. Removing assignment removes access unless the case remains on the allow-list.

`clients.edit = true` + `assigned_cases` ⇒ edit **only** those clients.

Guessing `/consultant/clients/999` from another firm ⇒ **404/403** (prefer 404 to reduce enumeration).

---

## 10. Case assignment

Owner UI on the case (additive panel, no journey rewrite):

- Assign / remove staff
- Set / change one `primary_case_manager`
- See workload (count of active assignments per member)

Staff **My Cases** = `GET /consultant/clients` already filtered by scope (do not show the full firm list when scoped).

Owner remains `case_files.consultant_id`. Staff assignment never transfers legal ownership.

---

## 11. Backend authorization strategy

New service: `App\Services\Team\TeamAccess` (name flexible).

```
TeamAccess::for(User $user)->workspaceForOwnerConsultantId(int $ownerId)
TeamAccess::for($user)->can(string $permission, ?ClientProfile $profile = null, ?CaseFile $case = null): bool
TeamAccess::for($user)->authorize(...) // abort 403
TeamAccess::for($user)->isWorkspaceOwner(int $ownerId): bool
```

**Phase 5:** replace `authorizeConsultant` and `ClientProfile::forConsultant($request->user()->id)` with:

- Owner: existing behavior (`id === consultant_id`).
- Staff: resolve workspace by `owner_user_id = profile.consultant_id`, then permission + scope.

List queries must use `TeamAccess::visibleClientQuery($user)` so staff never receive other rows and then 403 on click.

Do **not** rely on hiding buttons.

Central helpers beat 80 copy-pasted ifs, but a first PR may wrap the existing private methods to call `TeamAccess` so Phase 0–6 logic stays intact.

Middleware options:

- `auth:sanctum` unchanged
- `role:rcic,staff` on consultant workspace routes that staff may use
- Keep `role:rcic,super-admin,admin` on billing/referral (staff excluded)
- Optional `workspace.active` middleware: staff + owner subscription/grace check (closes today’s UI-only gap for **staff**; do not newly block existing owner API behavior unless approved — **open O6**)

Policies: introduce `ClientProfilePolicy` / `CaseFilePolicy` **or** stay with `TeamAccess` only. Recommend **TeamAccess first** (no policy rewrite of the whole app). Add policies later if useful.

Permission changes: read membership JSON on **every request** (no JWT-embedded ACL). Deactivate ⇒ `tokens()->delete()` immediately.

`GET /me` (or `GET /consultant/team/session`) must return:

```
actor_type: owner | staff
workspace: { id, owner_name, firm_name }
preset_key, access_scope
permissions: { ... }
```

Frontend reloads this on dashboard mount and after focus (cheap).

---

## 12. APIs (after approval)

Prefix `/api/v1`. Owner-only unless noted.

**Owner team**

- `GET /consultant/team`
- `GET /consultant/team/presets`
- `POST /consultant/team/invitations`
- `POST /consultant/team/invitations/{invitation}/resend`
- `DELETE /consultant/team/invitations/{invitation}`
- `GET /consultant/team/members/{member}`
- `PATCH /consultant/team/members/{member}`
- `PATCH /consultant/team/members/{member}/permissions`
- `PATCH /consultant/team/members/{member}/scope`
- `POST /consultant/team/members/{member}/deactivate|reactivate|revoke-sessions`

**Assignments**

- `GET /consultant/clients/{profile}/case-file/team`
- `POST /consultant/clients/{profile}/case-file/team`
- `DELETE /consultant/clients/{profile}/case-file/team/{member}`

**Public / auth invite**

- `GET /team/invitations/{token}` — limited: firm display name, invitee email, expiry (no owner id)
- `POST /team/invitations/{token}/accept` — password + name; rate limited

**Session**

- Extend `GET /me` with team context for `staff`

All team routes: owner must match workspace; staff hitting them without `team.manage` (not granted) → 403.

---

## 13. Consultant UI

New sidebar item **Team Management** (owner-only). Suggested path `/dashboard/team`.

Tabs: Members | Invitations | Presets (read-only explanation) | Activity

**Add member:** name, email, job title, preset, scope, permission checkboxes grouped as in the product brief. Consultant-only rows shown **disabled** with label “Consultant only”.

**Send invitation.**

Member detail: edit permissions/scope, deactivate, reactivate, revoke sessions, assigned cases.

Case workspace: additive **Team** card (assign staff). No change to Phase 0–6 step order.

---

## 14. Team-member dashboard UX

Same Consultant Dashboard shell.

Banner: `Team Member — {preset or job title}` + firm/owner name.

Nav: filter `navItems` by permissions. Always hide for staff:

- Billing / Subscribe
- Referrals & Wallet
- Team Management
- Account license / RCIC onboarding
- Owner company signature settings (or read-only firm branding)

Show **My Cases** (clients list already scoped).

`OnboardingGuard`: skip when `actor_type === staff`.  
`SubscriptionGuard`: check **owner** workspace subscription; if lapsed, staff see a locked message (cannot checkout).

---

## 15. Audit

`team_audit_events` for: invite, resend, cancel, accept, permission/scope change, assign/remove case, suspend, reactivate, revoke sessions, remove.

Case/document/form writes: pass `$request->user()->id` into existing `case_history_events` / `client_activity_logs` (they should already use auth user; verify in Phase 5 and fix only if they hardcode owner id).

Never overwrite history.

---

## 16. Notifications

New `NotificationType` values (enum `match` must list them), category `team`.

| Recipient | When |
|-----------|------|
| Invitee | Invitation (email is primary; in-app after accept) |
| Owner | Invitation accepted |
| Staff | Assigned to case / removed from case |
| Staff | Account deactivated |
| Staff | Task assigned — only if task notifications already exist; do not invent spam |

Skip notify on every checkbox toggle. Optional single “Your access was updated” if permissions or scope change (dedupe 1/hour).

---

## 17. Tenant isolation

- Every query starts from `workspace.owner_user_id` or membership workspace — never “all clients”.
- IDs from URL are authorized after load.
- Staff in Firm A cannot read Firm B even with `all_cases` on A.
- Tests 16–17 in the matrix are mandatory.
- Referral/wallet/billing tables stay keyed by owner `user_id`; staff tokens never pass `role:rcic`.

---

## 18. Security

- Invite token: 32+ bytes CSPRNG, hashed at rest, TTL, single-use, revocable.
- Password: existing `Password::min(8)->letters()->numbers()` (or current consultant rules).
- Email verification on accept (signed or `email_verified_at` set after confirm).
- Revoke tokens on deactivate/suspend/permission-critical removal.
- Invite rate limits; accept rate limits.
- Least privilege: presets must not include consultant-only keys.
- No MFA to hook (none exists).
- Do not store invite tokens or staff passwords in logs.

---

## 19. Subscription / seats

**Inspected:** `subscription_packages` has no seat field. Do **not** charge for seats in this implementation.

Schema-ready only:

- `consultant_workspaces.seat_limit_override`
- future `subscription_packages.max_team_seats`

**Recommend defer enforcement** (open O3). If approved later: count `members` where status in `active` + pending invitations.

Owner subscription still gates **workspace use** for staff (inherit). Staff cannot buy a second platform sub for the firm.

---

## 20. Migration strategy

1. Additive migrations only on `cws`.
2. Backfill: for each `users` with role `rcic`, optionally lazy-create workspace (no mass rewrite of `client_profiles`).
3. Existing PHPUnit must keep using owner tokens; `authorizeConsultant` still passes for owners.
4. Never `migrate:fresh`.

---

## 21. Phases

| Phase | Work | Starts after |
|-------|------|----------------|
| **0** | This inspection + matrix (this file) | — |
| **1** | Schema, models, lazy workspace, `staff` role seed | Approval |
| **2** | Invitations, accept, password, email verify | Phase 1 |
| **3** | Presets + permission JSON engine + strip consultant-only keys | Phase 2 |
| **4** | Scopes + `case_team_assignments` + filtered client list | Phase 3 |
| **5** | `TeamAccess` on existing modules (clients/cases/docs/forms/journey). Billing/referral remain `role:rcic`. | Phase 4 |
| **6** | Consultant Team Management UI | Phase 5 (or parallel after 3 if APIs stable) |
| **7** | Staff nav, banner, guard skips | Phase 5 |
| **8** | Audit, notifications, token revoke | Phase 5 |
| **9** | Full test matrix + `VERIFICATION.md` | Phases 1–8 |

Phase 5 is the highest-risk phase (many controllers). Implement as a single authorizer used by existing `authorizeConsultant` helpers first, then list-query scoping.

---

## 22. Test matrix

Backend PHPUnit (minimum):

1. Owner can create invitation  
2. Token hashed, single-use  
3. Expired invitation rejected  
4. Accept creates `staff` user + active membership  
5. Preset applied  
6. Customized permissions persist (not preset defaults)  
7. Override survives re-login  
8. Staff logs in on a separate user (not owner password)  
9. `GET /me` staff context; nav keys omit billing/wallet/team  
10. Hidden UI still 403 on API  
11. `clients.view` allowed  
12. `clients.edit` denied when off  
13. Assigned-case scope  
14. All-cases scope  
15. Selected-case scope  
16. Other workspace case 403/404  
17. Numeric ID enumeration blocked  
18. Assignment grants assigned scope  
19. Unassign removes access  
20. Permission removal immediate  
21. Deactivated 403 + tokens dead  
22. Reactivate restores saved ACL  
23. Revoke-sessions  
24. Staff action audit / history actor  
25. Permission-change audit  
26. Staff cannot manage subscription  
27. Staff cannot read referral/wallet  
28. Staff cannot withdraw  
29. Staff cannot `reviewProfile` / questionnaire verify  
30. Staff cannot `selectPathway`  
31. Staff cannot final-review sign-off / ready-to-submit  
32. Staff cannot hit client ack/sign routes successfully  
33. Staff cannot `recordSubmission`  
34. Owner retains full access  
35. Existing case-handling tests pass  
36. Existing subscription hardening tests pass  
37. Existing referral/wallet tests pass  

Frontend Vitest:

- nav visibility by permission  
- preset customization  
- scope selector  
- disabled consultant-only checkboxes  
- deactivated copy  

---

## 23. Files likely to change (after approval — not now)

- New: `app/Services/Team/*`, team models, migrations, controllers, `EnsureHasRole` consumers, Consultant Dashboard `/dashboard/team`, invite page on Consultant Website, `RolesAndPermissionsSeeder` (`staff`), `NotificationType` cases, `UserResource` team context.
- Touch: every `authorizeConsultant` / `forConsultant($request->user()->id)` in consultant workspace controllers (wrapper only).
- Touch: `OnboardingGuard`, `SubscriptionGuard`, `nav-main.tsx`, login role checks on Consultant Website + dashboard.
- Do not touch: Stripe fulfillment rules, referral qualification, case Phase 0–6 state machines, client portal sign routes (except ensuring staff 403).

After implementation: `docs/plans/team-staff-access/VERIFICATION.md` (not now).

---

## 24. Security risks (called out)

| Risk | Mitigation |
|------|------------|
| Assigning staff `rcic` | Never. New `staff` role only. |
| Copying client invite (password in email) | Tokenized invite only. |
| UI-only subscription | Staff inherit owner status; cannot checkout. |
| List endpoint leaks all firm clients | Scope at query layer. |
| Consultant-only key stored on member | Strip on write + deny on authorize. |
| Staff uses owner signature | Never load owner `digital_signature` for staff. |
| Cross-tenant IDOR | Workspace isolation tests. |

---

## Recommended locked decisions (approve to lock)

| # | Recommendation |
|---|----------------|
| **R1** | Thin `consultant_workspaces` now; one owner RCIC per workspace in v1. |
| **R2** | New Spatie role `staff`. Do not use `rcic` for staff. |
| **R3** | Fine-grained ACL on membership JSON, not Spatie permissions / not Spatie teams. |
| **R4** | Owner implicit full access; no owner membership row required. |
| **R5** | Presets are templates only. |
| **R6** | Consultant-only matrix in §8 is not assignable. |
| **R7** | Referral/wallet/withdrawal: staff never. |
| **R8** | Platform subscription manage: owner only. Staff inherit access. |
| **R9** | No `team.manage` for staff in v1. |
| **R10** | Invite: hashed token, expiry, single-use, revocable; Consultant Website accept URL. |
| **R11** | Do not merge staff into existing `rcic` / `client` / `admin` emails in v1. |
| **R12** | Replace id-equality authorize with `TeamAccess` without changing journey steps. |
| **R13** | Client `destroy` and case close remain owner-only. |
| **R14** | Document official verify/approve and form official review remain owner-only. |
| **R15** | Seat billing deferred; schema-ready only. |
| **R16** | Same Consultant Dashboard shell for staff. |
| **R17** | No production deploy; no `migrate:fresh`; no Phase 0–6 behavior change. |
| **R18** | `users.consultant_id` stays client-portal only. |

---

## Open decisions (need your approval)

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| **O1** | Workspace table now vs membership-only `employer_user_id` | workspace / membership-only | **workspace (R1)** |
| **O2** | Staff Spatie role name | `staff` / `consultant-staff` | **`staff`** |
| **O3** | Enforce max seats in v1 | defer / enforce with a hardcoded cap / package field | **defer** |
| **O4** | Staff `billing.view` (invoices of the firm) | no / yes view-only | **no** in v1 (platform billing is owner-sensitive) |
| **O5** | Staff may deactivate a **client** (`toggleStatus`) | no / yes via `clients.archive` | **no** — owner only |
| **O6** | Newly enforce owner subscription on **owner** APIs (today UI-only) | leave owner APIs as-is / enforce for everyone | **leave owner APIs as-is**; enforce inherit-check **for staff only** |
| **O7** | Letters, Legislations, Community, Storage, Marketing, LMS | extra assignable keys (default off) / always hide | **assignable, default off** |
| **O8** | Invitation email already registered | reject all existing users / allow existing `staff` to join second firm | **reject existing emails in v1** (simplest, no identity merge) |
| **O9** | Invite TTL | 3 / 7 / 14 days | **7 days** |
| **O10** | Selected scope = allow-list ∪ assignments | union / allow-list only / assignments only | **union** |
| **O11** | Team nav placement | Client Work / new Practice group / Overview | **Client Work** |
| **O12** | Staff Google OAuth | no / yes | **no** in v1 (password invite only) |

## Locked decisions (approved 2026-09-14)

R1–R18 and O1–O12 (all recommended) are locked. Do not reopen during implementation.

- Workspace layer now; Spatie role `staff`; no seat billing in v1.
- Staff never receive `rcic`; never share the owner login; hashed single-use expiring revocable invites; never email a password.
- Presets are templates; final access = membership + permissions + scope + tenant.
- Owner-only matrix in §8 stays non-assignable. Referral/wallet/billing manage stay owner-only. Staff inherit owner subscription/trial/grace only.
- Existing emails rejected on invite/accept (no identity merge).
- Selected scope = allow-list ∪ assignments.
- Team Management nav under Client Work.
- No staff Google OAuth in v1.
- Phase 5 uses centralized `TeamAccess` only; no Phase 0–6 journey rewrite.

Verification file `docs/plans/team-staff-access/VERIFICATION.md` is created **after** coding.

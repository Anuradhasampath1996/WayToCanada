# Named multi-case with auto-hold — Design

**Date:** 2026-08-27  
**Status:** Approved  
**Product:** RCICMaster / WayToCanada

## Problem

Consultants could not open a second case for the same client while another case was still active/incomplete. Cases had no human-readable name (`Case #N` only). Returning clients after years needed a clean new case without losing history.

## Decision

When a consultant creates a **new named case**:

1. All other cases for that client that are currently **`active`** → set to **`on_hold`** (closed/completed unchanged; already on_hold stay on_hold).
2. New case is created as **`active`**, status `PENDING_ASSESSMENT`, and becomes `active_case_file_id` (workspace + client dashboard focus).
3. Case requires a **name** (e.g. “Express Entry 2026”).
4. **Questionnaire** remains shared per client user (`user_id` unique) — no change.
5. Client dashboard continues to show only the **focused active case** via `active_case_file_id`.
6. **Resume** on a held case: that case → `active`; any other `active` case → `on_hold`; update `active_case_file_id`.

## Out of scope

- Client UI to browse historical held/closed cases (phase 2)
- Renaming UI beyond create (can add later via PATCH)
- Changing questionnaire to be per-case

## API

- `POST .../case-file/open-new` body: `{ "name": string (required), "note"?: string }`
- Responses include `name` / display `label` on case summaries

## UI

- Consultant Case management: “Open new case” always available (not only after close/complete)
- Dialog: name (required) + optional note
- Case switcher shows name + `#number` + lifecycle badge

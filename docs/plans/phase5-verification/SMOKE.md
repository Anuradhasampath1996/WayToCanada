# Phase 5 Post-submission — browser smoke

Date: 2026-09-13T04:37:01.101Z
Result: PASS (31 passed, 0 failed)

| Check | Result | Detail |
|-------|--------|--------|
| gate.presub_blocked | PASS | UI disabled=true API=422 |
| ui.submitted_can_add | PASS | Submitted case can add requests |
| gate.other_label_required | PASS | Other without a custom label is blocked |
| ui.all_request_types | PASS | types=portal_invitation,passport_request,pfl,interview,additional_documents,medical,biometrics,aor,other |
| history.created_once | PASS | created events=9 expected=9 |
| calendar.due_date | PASS | Due date appears on consultant calendar API |
| calendar.ui_visible | PASS | API has the event; dashboard copy may be month-collapsed |
| close.blocked_without_decision | PASS | close without decision HTTP 422 |
| lifecycle.in_progress | PASS | workflow=RESPONSE_IN_PROGRESS |
| close.blocked_open_request | PASS | close with open request HTTP 422 |
| history.answered | PASS | answered events=1 |
| lifecycle.no_duplicate_answered | PASS | retry HTTP 200 events=1 |
| lifecycle.cannot_move_back | PASS | answered → in-progress HTTP 422 |
| board.government_processing | PASS | workflow=GOVERNMENT_PROCESSING |
| client.presub_locked | PASS | Pre-submission client page is locked |
| client.available_readonly | PASS | readonly=true details=true |
| client.no_internal_fields | PASS | GET=200 POST=405 internal=false |
| client.notification | PASS | api=true ui=false count=36 |
| close.blocked_incomplete_checklist | PASS | close before checklist HTTP 422 |
| decision.recorded_with_letter | PASS | status=approved letter=true events=1 |
| decision.overwrite_blocked | PASS | overwrite HTTP 422 |
| decision.all_statuses | PASS | other-missing=422 other=200 refused=200 withdrawn=200 |
| client.sees_decision | PASS | Client portal shows recorded decision |
| close.checklist_complete | PASS | can_close=true |
| close.status | PASS | lifecycle=closed workflow=CASE_CLOSED events=1 |
| close.immutable | PASS | reclose HTTP 422 events=1 |
| regression.legacy_submitted | PASS | add HTTP 201 status=APPLICATION_SUBMITTED |
| regression.no_duplicate_refresh | PASS | legacy created events after refresh=1 |
| board.groups | PASS | main=GOVERNMENT_REQUEST_RECEIVED close=CASE_CLOSED group=post_submission |
| board.ui | PASS | Progress board shows grouped post-submission column |
| calendar.still_works | PASS | calendar events=3 |

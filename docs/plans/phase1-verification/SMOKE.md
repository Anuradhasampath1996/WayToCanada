# Phase 1 Eligibility Assessment — browser smoke

Date: 2026-09-13T02:58:07.979Z
Result: PASS (15 passed, 0 failed)

| Check | Result | Detail |
|-------|--------|--------|
| blocked.consultation_incomplete | PASS | UI shows Select Pathway locked |
| blocked.missing_core_fields | PASS | Review button disabled until core fields exist |
| blocked.skip_without_reason | PASS | Skip without reason did not unlock Select Pathway |
| intake.not_blocked_by_consultation | PASS | Questionnaire review opened without completing consultation |
| blocked.profile_not_reviewed_api | PASS | select-pathway before gates HTTP 422 |
| gates.consult_and_review_unlock | PASS | Select Pathway ready after consult + review |
| maple.structured_only | PASS | Maple recommendation stored |
| maple.never_auto_selects | PASS | Pathway still empty after Ask Maple |
| routing.study_checklist | PASS | Study family shows checklist, not CRS as primary |
| routing.express_entry_crs | PASS | Express Entry routes to CRS/FSW tools |
| blocked.selection_without_reason | PASS | select-pathway without reason HTTP 422: Record why this pathway was selected, including alternatives or risks as needed. |
| select.reason_required_and_optional_alts | PASS | Plan v1 key=Study Permit |
| snapshot.versioned_plan | PASS | case_requirement_plan #1 v1 |
| routing.work_family | PASS | Work Permit uses checklist/assessment items |
| routing.family_family | PASS | Family Sponsorship uses checklist/assessment items |

Screenshots are in `screenshots/`.

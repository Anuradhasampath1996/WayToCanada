# Phase 2 Auto-assign — browser smoke

Date: 2026-09-13T03:44:37.737Z
Result: PASS (7 passed, 0 failed)

| Check | Result | Detail |
|-------|--------|--------|
| study.forms_and_docs | PASS | Study forms=IMM 1294, IMM 5707, IMM5476 docs=passport, photos, proof_address, police_cert, medical_exam, acceptance_letter, ielts_results, transcripts, study_plan, proof_funds |
| study.ui_not_ee | PASS | Study panel shows study forms/docs, not EE-only ECA |
| reuse.intake_candidates | PASS | Passport, language, and education reuse candidates shown |
| ee.forms_and_docs | PASS | EE forms=IMM 0008, IMM 5669, IMM 5406, IMM 5562, IMM5476, express-entry-personal-details, express-entry-work-history, express-entry-education docs=passport, photos, proof_address, police_cert, medical_exam, ielts_results, eca, employment_refs, pay_stubs, tax_returns, express_entry_profile |
| ee.ui_not_study | PASS | EE panel shows EE forms/docs, not Study LOA |
| change.non_destructive | PASS | v1->v2 prev=8 obsolete=dli_number, program_name, program_start_date, funds_source, , acceptance_letter, transcripts, study_plan, proof_funds history=pathway_changed |
| change.ui_work_plan | PASS | After change, Work Permit checklist replaced Study items |

Screenshots are in `screenshots/`.

# Isolated staging journey

Date: 2026-09-13T13:28:42.439Z
API: http://127.0.0.1:8010/api/v1
Client: staging.journey.1789306097709@example.test (profile 2, case 2)
Result: PASS (29 passed, 0 failed)

| Stage | Result | Detail |
|-------|--------|--------|
| 01.invite | PASS | HTTP 201 |
| 02.profile | PASS | Client logged in after invite |
| 02.intake | PASS | save=200 submit=200 |
| 02.case_opened | PASS | HTTP 200 |
| 03.consultation_skip | PASS | HTTP 200 |
| 04.profile_review | PASS | HTTP 200 |
| 05.assessment | PASS | HTTP 200 |
| 06.maple_recommend_only | PASS | auto=false |
| 07.pathway_selection | PASS | v=1 |
| 08.retainer | PASS | send=200 sign=200 |
| 09.representative | PASS | activated=true |
| 10.additional_info | PASS | HTTP 200 |
| 11.documents | PASS | corr=200 verify=200 |
| 12.final_consultant_review | PASS | checklist=200 |
| 13.client_final_review | PASS | consultant_ack=403 client_ack=200 |
| 14.portal_confirmation | PASS | auto=false |
| 15.submission_record | PASS | submit=200 overwrite=422 |
| 16.government_request | PASS | HTTP 201 |
| 17.response | PASS | prog=200 ans=200 |
| 18.decision | PASS | first=200 second=422 |
| 19.closure | PASS | closed=true |
| sync.dashboard | PASS | prep=0 attention=0 gov=0 closed_not_attention=true |
| sync.pending_or_pipeline | PASS | pipeline=200 |
| sync.calendar | PASS | href=/dashboard/clients/2/workspace/case-management?tab=post-submission |
| sync.notifications | PASS | count=4 |
| sync.case_history | PASS | application_submitted=1 total=20 |
| sync.client_journey | PASS | HTTP 200 |
| audit.no_auto_submit | PASS | auto_submitted=false |
| audit.no_dup_history | PASS | application_submitted=1 |

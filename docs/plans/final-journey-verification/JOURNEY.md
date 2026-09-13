# Final journey live walk

Date: 2026-09-13T05:07:31.364Z
Client: rc.journey.1789275910860@example.test (profile 58, case 57)
Result: PASS (32 passed, 0 failed)

| Stage | Result | Detail |
|-------|--------|--------|
| 01.add_invite | PASS | HTTP 201 |
| 01.client_login | PASS | Client logged in after invite |
| 02.intake | PASS | save=200 submit=200 |
| 02.case_opened | PASS | HTTP 200 |
| 03.consultation_skip | PASS | HTTP 200 |
| 04.profile_review | PASS | HTTP 200 |
| 05.06.assessment | PASS | family=study |
| 07.maple_recommend_only | PASS | auto=false |
| 08.09.select_snapshot | PASS | v=1 key=Study Permit |
| 10.generated_requirements | PASS | forms=IMM 1294,IMM 5707,IMM5476 docs=passport,photos,proof_address,police_cert,medical_exam,acceptance_letter,ielts_results,transcripts,study_plan,proof_funds rep=required |
| 11.12.retainer | PASS | send=200 sign=200 |
| 13.14.representative_activation | PASS | HTTP 200 activated=true |
| 15.extra_data | PASS | HTTP 200 keys=dli_number,funds_source |
| 18.forms_prep | PASS | interactive=200 gov=200 unlocked=true |
| 16.17.documents | PASS | corr=200 resub=200 verify=200 |
| 19.20.final_review | PASS | checklist=200 ready=200 |
| audit.consultant_cannot_ack_sign | PASS | ack=403 sign=403 |
| 21.22.client_ack_sign | PASS | ack=200 sign=200 required=true |
| 23.24.portal_ready | PASS | portal=200 rts=200 |
| 25.submitted_immutable | PASS | submit=200 overwrite=422 |
| 26.27.gov_request_visible | PASS | cal=true client=biometrics |
| cross.notifications | PASS | count=4 |
| 28.request_lifecycle | PASS | prog=200 ans=200 |
| 29.decision_once | PASS | first=200 second=422 |
| 30.31.closure | PASS | close=200 closed=true |
| audit.history_no_dup_submit | PASS | application_submitted=1 total=20 |
| ui.dashboard | PASS | Dashboard counts and pending actions visible |
| ui.consultant_rail | PASS | 5-stage rail visible on closed/submitted case |
| ui.progress_board | PASS | Board shows the journey case in grouped columns |
| ui.client_journey | PASS | Client 5-stage journey visible |
| ui.no_internal_codes | PASS | No internal codes on client home |
| ui.mobile | PASS | Mobile dashboard usable |

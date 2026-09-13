# Phase 6 dashboard polish — browser smoke

Date: 2026-09-13T04:55:10.499Z
Result: PASS (17 passed, 0 failed)

| Check | Result | Detail |
|-------|--------|--------|
| api.counts | PASS | {"in_preparation":1,"needs_attention":1,"government_processing":6} |
| api.overdue_attention | PASS | add=201 attention=true overdue=true |
| api.quiet_not_attention | PASS | quiet=Submitted attention=false |
| api.no_dup_ids | PASS | rows=7 |
| dash.cards_link | PASS | Dashboard cards point at filtered board views |
| dash.pending_actions | PASS | Pending actions show case and actor/due info |
| dash.filter_attention | PASS | url=http://127.0.0.1:3005/dashboard/case-pipeline?view=needs_attention |
| dash.filter_prep | PASS | count=1 |
| dash.filter_gov | PASS | count=6 |
| rail.assessment | PASS | Grouped 5-stage rail is visible |
| rail.post | PASS | Submitted case is on the post-submission group |
| board.groups | PASS | Three grouped board sections remain |
| calendar.href | PASS | href=/dashboard/clients/52/workspace/case-management?tab=post-submission |
| notif.link | PASS | url=http://localhost:3002/user-dashboard/government-requests |
| client.five_stages | PASS | Client sees 5 friendly stages |
| client.no_internal_codes | PASS | No internal workflow codes on client home |
| ui.mobile | PASS | Mobile dashboard remains usable |

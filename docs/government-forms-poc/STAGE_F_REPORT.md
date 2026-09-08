# Stage F — Consultant Case Hub Government Forms UI

**Status:** Complete — ready for Stage G end-to-end verification  
**Date:** 2026-09-01  
**Scope:** IMM 5476 only; no backend architecture changes

---

## 1. Files created / modified

### Created
| File | Purpose |
|------|---------|
| `frontend/Consultant Dashbord/lib/government-forms-api.ts` | Typed API client for Stage E endpoints |
| `frontend/Consultant Dashbord/lib/government-forms-ui.ts` | Status labels, redirect mapping, date formatting |
| `frontend/Consultant Dashbord/app/dashboard/(auth)/clients/[id]/workspace/case-management/consultant-government-forms-panel.tsx` | Government Forms panel (review gate, IMM 5476 card, generation UX) |
| `frontend/Consultant Dashbord/vitest.config.ts` | Vitest configuration |
| `frontend/Consultant Dashbord/vitest.setup.ts` | Test setup (localStorage mock, jest-dom) |
| `frontend/Consultant Dashbord/lib/__tests__/government-forms-api.test.ts` | API URL / auth header tests |
| `frontend/Consultant Dashbord/lib/__tests__/government-forms-ui.test.ts` | Status / redirect helper tests |
| `frontend/Consultant Dashbord/app/dashboard/(auth)/clients/[id]/workspace/case-management/consultant-government-forms-panel.test.tsx` | Panel component tests |

### Modified
| File | Change |
|------|--------|
| `frontend/Consultant Dashbord/app/dashboard/(auth)/clients/[id]/workspace/case-management/case-management-client.tsx` | Added **Government Forms** tab and panel wiring |
| `frontend/Consultant Dashbord/package.json` | Added `test` / `test:watch` scripts and vitest + Testing Library devDependencies |

---

## 2. Existing components reused

- `Button`, `Badge`, `Dialog` from `@/components/ui/*`
- `PdfViewerDialog` for authenticated inline PDF preview
- `cn` utility, Lucide icons (`FileCheck`, `ShieldAlert`, etc.)
- Case Hub tab layout, toast pattern (`showToast` callback from `case-management-client.tsx`)
- Existing auth pattern: `localStorage` bearer token + `NEXT_PUBLIC_API_URL`
- Link navigation to `/dashboard/clients/{id}/workspace/questionnaire-review` and `/dashboard/account`

---

## 3. Final Case Hub placement

**Case Management Hub tabs (left → right):**

1. Overview  
2. Documents  
3. Application Forms *(interactive forms — unchanged)*  
4. **Government Forms** ← new  
5. Messages  

Government Forms lives inside the existing Case Hub workspace (`/dashboard/clients/{id}/workspace/case-management`). No new top-level workflow step was added.

---

## 4. API integrations completed

| Method | Endpoint | Used by |
|--------|----------|---------|
| GET | `/consultant/clients/{profile}/government-forms` | Panel load / refresh |
| POST | `/consultant/clients/{profile}/government-forms/application-info/review` | Review gate button |
| POST | `/consultant/clients/{profile}/government-forms/{formCode}/generate` | Generate / Regenerate |
| POST | `/consultant/clients/{profile}/government-forms/generations/{submission}/mark-reviewed` | Mark Reviewed |
| GET | `/consultant/clients/{profile}/government-forms/generations/{submission}/download` | Download + Preview |

Readiness is loaded via the index endpoint (`forms[].readiness`); no frontend readiness calculation.

---

## 5. Review gate behaviour

When `application_info_reviewed === false`:

- Panel shows explanatory copy and **Review Application Information** button
- IMM 5476 card shows readiness percentage but blocks generation actions
- Clicking review calls `POST …/application-info/review`, then refreshes index state
- After success: reviewed banner with timestamp; readiness/generation enabled per backend

Backend remains authoritative — no client-side faking of review state.

---

## 6. Readiness UI behaviour

Each form card displays:

- **Percentage** from `readiness.percentage` (not computed in frontend)
- **Ready / Not Ready** badge from `readiness.ready`
- Missing count summary when not ready
- **View Missing Information** opens a Dialog listing `missing_fields[]` with labels
- Redirect hints map to existing workspace routes (`questionnaire-review`, `/dashboard/account`)

---

## 7. Generation UX

- **Generate Form** shown only when reviewed + ready + no current generation
- **Regenerate** shown when reviewed + ready + current generation exists
- Duplicate submission guarded (`generating` state + early return)
- Loading spinner and disabled button during generation
- Errors surfaced via toast and inline alert — no optimistic “Generated” state
- After success: index refresh shows latest generation metadata

Display statuses: Ready to Generate, Generating…, Needs Review, Reviewed, Outdated (stale), Error.

---

## 8. Download implementation

- Downloads use `GET …/generations/{submission}/download?download=1` with bearer auth
- Blob download via `downloadGovernmentFormPdf()` — no storage paths exposed
- Preview uses same endpoint without `download=1` through `PdfViewerDialog`
- Post-download Adobe Acrobat Reader note displayed prominently

---

## 9. Review / regeneration behaviour

- **Mark Reviewed** calls backend endpoint; refreshes state on success
- Reviewed displayed separately from “Submitted” / submission-ready
- **Regenerate** reuses generate endpoint; backend handles supersession
- Only latest generation shown prominently (no new history backend)
- Stale warnings when `application_info_stale` or `current_generation.is_stale`

---

## 10. Responsive behaviour

- Tab bar scrolls horizontally on small screens (existing Case Hub pattern)
- Form cards stack vertically; header row collapses from row to column on mobile
- Action buttons wrap (`flex-wrap`) — no wide tables
- Dialog max-width constrained for mobile

---

## 11. Tests added

**Frontend (Vitest + Testing Library) — 23 tests**

- Government Forms section renders with API data
- Review gate when unreviewed
- Review action calls API and refreshes
- Readiness percentage from API
- Missing information dialog
- Generate hidden when not ready
- Duplicate generate prevented
- Successful generation shows metadata
- Secure download helper used
- Mark Reviewed refreshes state
- API error + retry
- Stale generation warning

**Backend regression (unchanged Stage E suite) — 18 tests**

---

## 12. Test results

```
Frontend:  23 passed (3 files)
Backend:   18 passed (76 assertions) — GovernmentForms filter
```

Test DB: started via `scripts/start-test-postgres.ps1` (PostgreSQL on 127.0.0.1:5433).

---

## 13. UI description (precise)

**Government Forms tab — unreviewed state**

```
┌─────────────────────────────────────────────────────────┐
│ [info banner: Adobe Acrobat Reader requirement]         │
├─────────────────────────────────────────────────────────┤
│ Application Information Review                          │
│ Application information must be reviewed before…        │
│ [Review Application Information]                        │
├─────────────────────────────────────────────────────────┤
│ IMM5476  v11-2025                    85%                │
│ Use of a Representative              Readiness          │
│ Review application information to unlock…               │
└─────────────────────────────────────────────────────────┘
```

**After review — ready to generate**

```
│ ✓ Application information reviewed · Sep 1, 2026        │
├─────────────────────────────────────────────────────────┤
│ IMM5476  v11-2025                   100%                │
│ Use of a Representative                                 │
│ [Ready to Generate]                                     │
│                              [Generate Form]            │
```

**After generation**

```
│ Latest generation                                       │
│ Generated Sep 1, 2026                                   │
│ [Download] [Preview] [Mark Reviewed] [Regenerate]         │
│ Open this official form in Adobe Acrobat Reader…        │
```

---

## 14. Backend issues discovered

**None.** Stage E backend behaved as specified during UI integration and regression testing. No generation architecture changes were required.

---

## 15. Stage F readiness for Stage G

**Yes — Stage F is complete and ready for Stage G.**

Stage G should verify through the live Consultant Dashboard UI:

Consultant UI → API → CaseFile snapshot → readiness → XFA mapping → Java pdfXFA processor → private storage → secure download → downloaded PDF → Adobe Acrobat Reader acceptance.

**Manual verification path:**

1. Open `http://localhost:3005` → client workspace → Case Management  
2. Select **Government Forms** tab  
3. Review application information  
4. Confirm IMM 5476 readiness  
5. Generate → Download → open in Adobe Acrobat Reader  
6. Mark reviewed  

IMM 5406 remains deferred until after Stage G.

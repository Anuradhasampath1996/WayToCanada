# Stage H — IMM 5406 Full Integration

**Status:** **COMPLETE** — Adobe Acrobat Reader acceptance passed (2026-09-01).

**Verified:** 2026-09-01 (dev environment)

---

## Summary

Stage H integrated **IMM 5406 (05-2026)** into the existing Government Forms pipeline shared with IMM 5476:

CaseFile → reviewed snapshot → canonical family data → readiness (+ overflow) → XFA mappings → iText pdfXFA append → private storage → secure download

IMM 5476 behaviour was **not modified**.

---

## Template verification

| Check | Result |
|-------|--------|
| Version | **05-2026** |
| Technology | **XFA_DYNAMIC** (pure XFA) |
| Template SHA-256 | `4f544818e48b7355b2b7bb0dc89feed47fdd7e7ce836075b5d3c9489ed315b27` |
| Official PDF | `https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5406/01-05-2026/imm5406e.pdf` |
| Mapping status | VERIFIED / ACTIVE |

---

## Canonical data sources (no duplicate storage)

| IMM 5406 section | RCICMaster source |
|------------------|-------------------|
| Applicant (Section A) | `main_data` + `step1_data` |
| Spouse (Section A) | `spouse_data` (conditional if married) |
| Parent1 / Parent2 | `accompanying_data` where `relationship = my_parent` |
| Children (Section B, 3 slots) | `children_data[]` |
| Siblings / other (Section C, 3 slots) | `accompanying_data` (`sibling`, `spouse_parent`, `in_law`, `other`) |

Snapshot now includes `accompanying_data`.

---

## Overflow detection

| Section | Template capacity | Behaviour |
|---------|-------------------|-----------|
| Children | 3 | Blocks readiness + generation; explicit API/UI warning |
| Siblings/other | 3 | Blocks readiness + generation |
| Parents | 2 | Blocks if >2 `my_parent` entries |

No silent truncation.

---

## Stage H E2E result (UI-parity HTTP)

| Field | Value |
|-------|-------|
| Profile ID | **14** |
| Case file ID | **14** |
| Consultant | `stageh.consultant@rcicmaster.test` / `StageHTest123!` |
| Submission ID | **10** |
| Readiness | **100%** |
| Output SHA-256 | `fcb0766fbc500d8698c14a54f6b14a75abf414cc6b0c6e749d06c80a4b774b56` |
| Downloaded SHA-256 | **Match** |

### Synthetic values in questionnaire

- Applicant: **Synthetic STAGEHTEST**
- Child: **Child One STAGEH**
- Parent1: **Parent One STAGEH**
- Parent2: **Parent Two STAGEH**

---

## Adobe acceptance file — open this in Acrobat Reader

```
f:\WayToCanada\WayToCanada\docs\government-forms-poc\stage-h\artifacts\IMM5406-StageH-10.pdf
```

Downloaded via secure endpoint:
`GET /api/v1/consultant/clients/14/government-forms/generations/10/download?download=1`

---

## Manual Adobe checklist — result

All 10 criteria **PASS** (user confirmed 2026-09-01):

1. Actual IMM 5406 renders — PASS  
2. Synthetic populated values visible — PASS  
3. Fields editable — PASS  
4. Save works — PASS  
5. Save/reopen retains values — PASS  
6. Reset works — PASS  
7. Print works — PASS  
8. Validate works — PASS  
9. Repeatable/family sections and validation messages behave normally — PASS  
10. No repair/corruption/security warning; layout intact — PASS  

**IMM 5406 full RCICMaster end-to-end integration is APPROVED.**

---

## Test totals

| Suite | Result |
|-------|--------|
| Backend `--filter=GovernmentForm` | **27 / 27 passed** |
| Frontend `pnpm test` | **23 / 23 passed** |

---

## Case Hub URL

http://localhost:3005/dashboard/clients/14/workspace/case-management → **Government Forms**

Both **IMM 5476** and **IMM 5406** appear when active.

---

## Production note

Production deployment remains **blocked** until commercial iText Core + pdfXFA licensing is approved.

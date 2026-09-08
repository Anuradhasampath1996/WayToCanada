# Government Form Compatibility Matrix

Last updated: 2026-09-08 (C3 IMM0008 / C2 IMM5562 / C1 study-work)

| Form | Version | Technology | Engine | Structural | E2E | Adobe | Status |
|------|---------|------------|--------|------------|-----|-------|--------|
| IMM 5476 | 11-2025 | ACROFORM_XFA_HYBRID | pdfXFA append | PASS | PASS | PASS | **SUPPORTED** · **E2E_VERIFIED** · **ADOBE_VERIFIED** |
| IMM 5406 | 05-2026 | XFA_DYNAMIC | pdfXFA append | PASS | PASS | PASS | **SUPPORTED** · **E2E_VERIFIED** · **ADOBE_VERIFIED** |
| IMM 0008 | 05-2026 | XFA_DYNAMIC | pdfXFA append | PASS (C3 merge) | pending | pending | **SUPPORTED** (C3 — +native/communicate languages) |
| IMM 5562 | 07-2024 | XFA_DYNAMIC | pdfXFA append | PASS (C2 travel) | pending | pending | **SUPPORTED** (C2 — name + up to 3 travelHistory rows) |
| IMM 5669 | 05-2021 | XFA_DYNAMIC | pdfXFA append + datasets inject | PASS (inject PoC) | pending | pending | **SUPPORTED** (C1 — name/DOB/parents; see IMM5669_FILL_STRATEGY.md) |
| IMM 1294 | 06-2026 | XFA_DYNAMIC | pdfXFA append | PASS (C1 skeleton) | pending | pending | **SUPPORTED** (C1 — identity/contact/passport/languages) |
| IMM 1295 | 09-2023 | XFA_DYNAMIC | pdfXFA append | PASS (C1 skeleton) | pending | pending | **SUPPORTED** (C1 — identity/contact/passport/languages) |
| IMM 5707 | 01-2023 | XFA_DYNAMIC | pdfXFA append | PASS (C1 skeleton) | pending | pending | **SUPPORTED** (C1 — applicant/spouse/parents/child 0) |

**Production deployment:** Blocked until commercial iText Core + pdfXFA licensing.

When an official IRCC template hash changes, registry sets `REVALIDATION_REQUIRED` until mappings, tests, and Adobe validation are completed.

## Template fingerprints

| Form | SHA-256 |
|------|---------|
| IMM 5476 (11-2025) | `aca5c476b93d1c496b1afbc2cfe843499e852e31dcf0c192153bd01f8d6c56c4` |
| IMM 5406 (05-2026) | `4f544818e48b7355b2b7bb0dc89feed47fdd7e7ce836075b5d3c9489ed315b27` |
| IMM 0008 (05-2026) | `2560489b57160f59c54a58d2f837d220a0426285ec17465c487b6fe2a5f63285` |
| IMM 5562 (07-2024) | `aeb0b9ae7322c847b03429fcf8c05efb595d59f5992bd54b1d67fd0b2bd3d52e` |
| IMM 5669 (05-2021) | `4bdc23bb6a9dfa3731927f9b93295fb14008ee504d02b3037e349c4cda421f7a` |
| IMM 1294 (06-2026) | `394c745501ef87e46a0b15618ca342387ca06c5b2f226face2956b0372047d09` |
| IMM 1295 (09-2023) | `57fc256eef7d9d856e4ae85ebf8bfe80da41833ebde7a8c7ed78f2483470d7bb` |
| IMM 5707 (01-2023) | `6e59d35048ef3995e1d4583f08c38a710a351e23b1cc0fbfe517d82f38cb20ef` |

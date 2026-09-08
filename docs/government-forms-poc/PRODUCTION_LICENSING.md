# Government Forms — Production Licensing Checkpoint

Last updated: 2026-09-01 (Production Readiness Closure)

## Status

**Production deployment is BLOCKED** until commercial iText licensing is procured and approved by commercial/legal stakeholders.

This document describes technical requirements only. It does **not** constitute legal approval or license procurement.

---

## Required commercial components

| Component | Purpose | Current dev/PoC state |
|-----------|---------|---------------------|
| **iText Core** (commercial) | PDF read/write, encryption handling | AGPL evaluation JAR in `form-processor-poc/java-itext` |
| **iText pdfXFA** (commercial add-on) | XFA datasets append-mode fill | Used in PoC + production path via `JarGovernmentPdfEngine` |

---

## Exact dependency versions (current PoC build)

From `form-processor-poc/java-itext/pom.xml`:

| Maven artifact | GroupId | Version |
|----------------|---------|---------|
| `kernel` | `com.itextpdf` | **8.0.5** |
| `forms` | `com.itextpdf` | **8.0.5** |
| `bouncy-castle-adapter` | `com.itextpdf` | **8.0.5** |
| `pdfxfa` | `com.itextpdf` | **3.0.3** |

Java compiler target: **17**

These coordinates pull **AGPL/evaluation** artifacts suitable for R&D only. Production must replace them with **commercially licensed** iText Core + pdfXFA builds of equivalent or newer compatible versions, subject to iText licensing terms.

---

## Current versions (PoC / dev)

| Artifact | Location |
|----------|----------|
| Java processor JAR | `form-processor-poc/java-itext/target/government-form-poc-itext-0.1.0-SNAPSHOT.jar` |
| Laravel binding | `backend/app/Implementations/GovernmentForms/JarGovernmentPdfEngine.php` |
| Config | `backend/config/government_forms.php` → `processor.jar_path`, `processor.java_binary` |

Verify exact iText library versions in `form-processor-poc/java-itext/pom.xml` before procurement.

---

## Deployment models

### Option A — Co-located JAR (current architecture)

- Laravel API invokes Java via `Process` / Windows `proc_open` shell wrapper
- Suitable for single-VM or container with JRE installed
- Requires commercial iText JARs on the application host

### Option B — Sidecar processor service (future)

- `FormProcessorClient` HTTP client already exists as alternate driver
- Sidecar must also use commercially licensed iText artifacts
- Token auth via `GOVERNMENT_FORM_PROCESSOR_TOKEN`

---

## Configuration for commercial runtime

Environment variables (see `backend/config/government_forms.php`):

| Variable | Purpose |
|----------|---------|
| `GOVERNMENT_FORM_PROCESSOR_DRIVER` | `jar` (default) or HTTP client |
| `GOVERNMENT_FORM_PROCESSOR_JAR` | Path to commercial-licensed JAR |
| `GOVERNMENT_FORM_PROCESSOR_JAVA` | Full path to JRE `java.exe` if needed (Windows) |
| `GOVERNMENT_FORM_PROCESSOR_TIMEOUT` | Processor timeout (default 120s) |

Production checklist:

1. Replace evaluation/AGPL iText artifacts with commercial builds
2. Remove any `setUnethicalReading(true)` or equivalent evaluation-only flags
3. Store official IRCC templates in private storage only
4. Keep `government_forms.licensing.production_blocked = false` only after legal sign-off

---

## Evaluation artifacts that must NOT ship to production

- AGPL-licensed iText evaluation JARs built for PoC
- PoC output directories under `government-forms-poc/output/`
- Debug scripts (`stage-g-*`, `stage-h-*` dev fixtures) — dev only
- Any dependency explicitly marked evaluation-only in `pom.xml`

---

## Legal / procurement actions required

1. Confirm required iText SKU (Core + pdfXFA) with iText sales/licensing
2. Obtain commercial license agreement covering expected PDF volume and deployment topology
3. Legal review of redistribution / SaaS multi-tenant use
4. Document license keys or deployment entitlement mechanism
5. Sign-off from RCICMaster commercial/legal before setting `production_blocked` to false

---

## Items to replace/configure after commercial licensing

1. Rebuild processor JAR against commercial iText Maven repository / artifacts (not AGPL evaluation)
2. Set `GOVERNMENT_FORM_PROCESSOR_JAR` to deployed commercial JAR path
3. Remove evaluation-only flags (e.g. unethical reading) from Java source if present
4. Set `government_forms.licensing.production_blocked` to `false` **only after legal/commercial sign-off**
5. Document license entitlement mechanism (key, volume cap, deployment topology) in internal ops runbook
6. Verify production host/container includes JRE **17+**

---

## RCICMaster policy flag

`config/government_forms.php`:

```php
'licensing' => [
    'production_blocked' => true,
    'note' => 'Commercial iText Core + pdfXFA licensing required before production deployment.',
],
```

Do not disable until commercial license is confirmed.

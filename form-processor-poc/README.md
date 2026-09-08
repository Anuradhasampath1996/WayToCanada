# Government Form Processor — Technical PoC

Restricted spike for IMM 5476 only. **Not production code.**

## Prerequisites

- PHP/Laravel backend commands (template fetch + inspect orchestration)
- Python 3.12+ with PyMuPDF: `pip install pymupdf`
- Java 17+ and Maven (for iText evaluation PoC)
- Optional: Aspose.PDF evaluation license/JAR for comparative PoC

## Step 1 — Fetch official template

From `backend/`:

```bash
php artisan government-forms:fetch-official IMM5476
```

This downloads the current official PDF from Canada.ca, stores it under `storage/app/private/government-forms-poc/templates/official/`, writes a manifest with SHA-256, and compares against any existing `application-packages` copies.

## Step 2 — Inspect template (PoC A)

```bash
php artisan government-forms:inspect --form=IMM5476
```

Or directly:

```bash
python form-processor-poc/python/inspect_pdf.py storage/app/private/government-forms-poc/templates/official/<file>.pdf
```

## Step 3 — Engine fill tests (PoC B)

### iText (evaluation)

```bash
cd form-processor-poc/java-itext
mvn -q package
java -jar target/government-form-poc-itext.jar inspect <template.pdf>
java -jar target/government-form-poc-itext.jar fill <template.pdf> <output.pdf> field1=value1 field2=value2
```

### Aspose (optional evaluation)

See `java-aspose/README.md` — requires Aspose.PDF evaluation JAR/license.

## Step 4 — Adobe manual checklist

See `docs/government-forms-poc/ADOBE_ACCEPTANCE_CHECKLIST.md`

## Licensing note

Evaluation/trial licenses may be used for this PoC only. **Do not deploy AGPL or unlicensed commercial PDF libraries to production RCICMaster without legal review and an approved commercial license.**

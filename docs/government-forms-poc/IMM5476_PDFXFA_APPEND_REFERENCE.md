# IMM 5476 — iText pdfXFA Append-Mode Reference Implementation

> **Status:** `TECHNICAL_POC_PASS` (Adobe manual acceptance confirmed 2026-09-01)  
> **Not production-ready** until commercial licensing and production integration are complete.

## Summary

| Property | Value |
|----------|-------|
| Form | IMM 5476 (11-2025) |
| Engine | iText Core + **pdfXFA** |
| Write strategy | **XFA datasets + append mode** |
| Adobe acceptance | **PASS** (all 8 checklist items) |
| Encryption | **PRESERVED** |
| Interactive behaviour | **PRESERVED** (Save, Reset, Print, editable fields) |
| Flattening | **NO** |
| AcroForm `/V` sync | **NO** — datasets-only write; Adobe reads XFA data |

## Rejected approaches (do not use for IMM 5476)

| Approach | Result |
|----------|--------|
| iText Core AcroForm `/V` only | Adobe FAIL — datasets unchanged |
| iText Core + appearance regeneration | Adobe FAIL — datasets unchanged |
| iText pdfXFA rewrite (non-append) | Encryption stripped; UR3 at risk |
| PyMuPDF AcroForm fill | Not production candidate |
| Aspose AcroForm fill | Datasets unchanged |

---

## Environment

| Component | Version |
|-----------|---------|
| Java | 17 |
| iText Core (`kernel`, `forms`) | **8.0.5** |
| iText pdfXFA | **3.0.3** |
| Bouncy Castle adapter | 8.0.5 (encrypted template read — **PoC diagnostic only**) |
| Maven shade plugin | 3.6.0 |
| Official template SHA-256 | `aca5c476b93d1c496b1afbc2cfe843499e852e31dcf0c192153bd01f8d6c56c4` |

## Maven dependencies (`form-processor-poc/java-itext/pom.xml`)

```xml
<itext.version>8.0.5</itext.version>
<itext.pdfxfa.version>3.0.3</itext.pdfxfa.version>

<!-- repository: https://repo.itextsupport.com/releases -->

<dependency>
    <groupId>com.itextpdf</groupId>
    <artifactId>kernel</artifactId>
    <version>${itext.version}</version>
</dependency>
<dependency>
    <groupId>com.itextpdf</groupId>
    <artifactId>forms</artifactId>
    <version>${itext.version}</version>
</dependency>
<dependency>
    <groupId>com.itextpdf</groupId>
    <artifactId>pdfxfa</artifactId>
    <version>${itext.pdfxfa.version}</version>
</dependency>
<dependency>
    <groupId>com.itextpdf</groupId>
    <artifactId>bouncy-castle-adapter</artifactId>
    <version>${itext.version}</version>
</dependency>
```

---

## Reproducible command sequence

### 1. Fetch official template

```bash
cd backend
php artisan government-forms:fetch-official IMM5476
```

### 2. Build PoC JAR

```bash
cd form-processor-poc/java-itext
mvn package
```

### 3. Fill via XFA datasets (append mode)

```bash
java -jar target/government-form-poc-itext-0.1.0-SNAPSHOT.jar fill-xfa-datasets \
  "backend/storage/app/private/government-forms-poc/templates/official/imm5476-official-aca5c476b93d.pdf" \
  "form-processor-poc/fixtures/imm5476_synthetic_datasets.xml" \
  "backend/storage/app/private/government-forms-poc/output/IMM5476_itext_pdfxfa_append_test.pdf" \
  append
```

### 4. Structural validation

```bash
python form-processor-poc/python/deep_pdf_diff.py \
  <official-template.pdf> \
  <output.pdf> \
  reports/diff.json
```

### 5. Adobe manual acceptance

Use `docs/government-forms-poc/ADOBE_ACCEPTANCE_CHECKLIST.md`.

---

## Java implementation (reference)

Location: `form-processor-poc/java-itext/src/main/java/com/rcicmaster/governmentforms/ItextPocMain.java`

### Writer configuration

```java
// Append mode preserves original byte ranges + encryption + UR3 signature integrity
PdfReader reader = openReader(template);  // PoC only: setUnethicalReading(true)
PdfWriter writer = new PdfWriter(output.toString());
PdfDocument pdf = new PdfDocument(reader, writer, new StampingProperties().useAppendMode());

PdfAcroForm acro = PdfAcroForm.getAcroForm(pdf, true);
XfaForm xfa = acro.getXfaForm();

try (FileInputStream xmlStream = new FileInputStream(datasetsXml.toFile())) {
    xfa.fillXfaForm(xmlStream);  // Replaces datasets/data node
}
xfa.write(pdf);
// Do NOT flatten
```

### Datasets XML format

File: `form-processor-poc/fixtures/imm5476_synthetic_datasets.xml`

Structure must match XFA data binding paths under `IMM_5476/Page1/...` — not AcroForm field names.

Example nodes populated in PoC:
- `SectionA/familyName`, `SectionA/givenName`
- `SectionB/familyName`, `SectionB/givenName`
- `SectionB/question6/questionII/ICCRCMember`
- `SectionB/question7/organization`, `SectionB/question7/email`

### AcroForm `/V` synchronization

**Not performed.** Append-mode fill updates only the XFA datasets packet. Adobe Acrobat renders from XFA data; AcroForm `/V` may remain empty without affecting display.

---

## Output validation checklist (automated)

See `backend/tests/Unit/GovernmentFormsImm5476RegressionTest.php` and structural diff script.

Verified on successful output:
- datasets packet SHA-256 **changes**
- all 7 synthetic string values present in datasets XML
- page count = 4
- XFA packets present (10 packets)
- encryption enabled
- output parses as valid PDF
- not flattened (interactive fields remain)

**Adobe compatibility is NOT automated** — remains manual acceptance per supported form version.

---

## Production migration notes (future)

1. Obtain **commercial iText Core + pdfXFA** licenses before sidecar deployment.
2. Remove `setUnethicalReading(true)` — use licensed APIs that respect document permissions.
3. Remove AGPL evaluation JAR from production images.
4. Store filled PDFs on **private** disk only (`storage/app/private/...`).
5. Scope generation to `CaseFile` with source-data snapshot hash.
6. Never use Core AcroForm-only fill for XFA-hybrid IRCC forms.

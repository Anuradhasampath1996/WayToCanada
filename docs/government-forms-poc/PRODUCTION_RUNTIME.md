# Government Forms — Production Runtime Packaging

Last updated: 2026-09-01 (Production Readiness Closure)

## Runtime stack

| Component | Version / artifact |
|-----------|-------------------|
| **Java (JRE/JDK)** | **17+** (matches `pom.xml` compiler target) |
| **iText Core (`kernel`, `forms`, `bouncy-castle-adapter`)** | **8.0.5** |
| **iText pdfXFA** | **3.0.3** |
| **Processor JAR (dev/PoC)** | `form-processor-poc/java-itext/target/government-form-poc-itext-0.1.0-SNAPSHOT.jar` |
| **Laravel processor binding** | `App\Implementations\GovernmentForms\JarGovernmentPdfEngine` |
| **Alternate driver** | HTTP via `FormProcessorClient` (`GOVERNMENT_FORM_PROCESSOR_DRIVER=http`) |

Build processor JAR (dev):

```bash
cd form-processor-poc/java-itext
mvn -q package
```

**Do not ship the PoC/AGPL evaluation JAR as the production artifact.** Replace with commercially licensed iText builds after procurement.

---

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `GOVERNMENT_FORM_PROCESSOR_DRIVER` | `jar` | `jar` or HTTP sidecar |
| `GOVERNMENT_FORM_PROCESSOR_JAR` | repo `target/...SNAPSHOT.jar` | Commercial JAR path in production |
| `GOVERNMENT_FORM_PROCESSOR_JAVA` | `java` | Full path to `java.exe` / `java` if not on PATH |
| `GOVERNMENT_FORM_PROCESSOR_TIMEOUT` | `120` | Processor timeout (seconds) |
| `GOVERNMENT_FORM_PROCESSOR_CONNECT_TIMEOUT` | `10` | HTTP processor connect timeout |
| `GOVERNMENT_FORM_PROCESSOR_URL` | `http://127.0.0.1:8091` | HTTP processor base URL |
| `GOVERNMENT_FORM_PROCESSOR_TOKEN` | — | Bearer token for HTTP processor |
| `FILESYSTEM_DISK` | `local` | Must remain private-root disk for generated PDFs |
| `APP_DEBUG` | `false` in production | Prevents verbose error leakage |

---

## Storage layout (private)

| Purpose | Relative path (under `storage/app/private`) |
|---------|-----------------------------------------------|
| Official templates | `government-forms-poc/templates/official/` (seeded) + `government-forms/templates/` |
| Generated PDFs | `government-forms/generated/{case_file_id}/` |
| Temp working files | `government-forms/temp/` + OS temp (`tempnam`) for datasets XML |

Local disk config (`config/filesystems.php`):

- `local` root = `storage/app/private`
- `serve` = **false** (no public URL mapping)

Download serving resolves DB metadata through `GovernmentFormStoragePathValidator` and must remain inside `government-forms/generated/`.

---

## Processor invocation

### Linux production (recommended)

Symfony `Process` with argument array — **no shell**:

```
java -jar /path/to/commercial.jar fill-xfa-datasets <template> <datasets.xml> <output.pdf> append
```

### Windows development (`php artisan serve`)

When `PHP_OS_FAMILY === 'Windows'` and `PHP_SAPI === 'cli-server'`, Symfony Process fails; the Stage G workaround uses `proc_open` with `bypass_shell => false` and **cmd.exe-safe quoting** for:

- Java binary (config/discovery)
- JAR path (config)
- Fixed subcommand allowlist: `inspect`, `fill-xfa-datasets`, `compare`
- Application-generated template/output/temp paths only

**No questionnaire or client values enter the command line.**

Subcommands are allowlisted in `JarGovernmentPdfEngine::ALLOWED_SUBCOMMANDS`.

---

## Laravel configuration files

| File | Role |
|------|------|
| `config/government_forms.php` | Processor, storage roots, supported forms, readiness rules, licensing gate |
| `config/filesystems.php` | Private `local` disk |
| `config/government_forms_poc.php` | PoC-only mappings (not production runtime) |

---

## Queue / process expectations

- Generation is **synchronous** in the HTTP request (no queue worker required today)
- Processor timeout defaults to **120s** — tune for production load
- Failed generation rolls back DB submission; temp datasets XML deleted in `finally`
- No separate worker process unless HTTP sidecar driver is adopted

---

## Backup implications

Generated government PDFs live in private storage and are referenced by `ircc_package_document_submissions.file_path`, `output_sha256`, and generation metadata. Include `storage/app/private/government-forms/generated/` in backup scope alongside the CWS database.

---

## Production config checklist

- [ ] `APP_DEBUG=false`
- [ ] `APP_ENV=production`
- [ ] Commercial iText JAR deployed (not PoC/AGPL)
- [ ] JRE 17+ installed on app host or sidecar
- [ ] `GOVERNMENT_FORM_PROCESSOR_JAR` points to commercial artifact
- [ ] Private storage permissions restricted to app user
- [ ] No secrets/PII/license keys in source control
- [ ] CORS + Sanctum auth unchanged for consultant API
- [ ] Log review: no datasets XML, passport, or full paths in production logs

See also: `PRODUCTION_LICENSING.md`, `PRODUCTION_CONFIG_AUDIT.md`

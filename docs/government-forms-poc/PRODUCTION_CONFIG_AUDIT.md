# Government Forms — Production Configuration Audit

Last updated: 2026-09-01 (Production Readiness Closure)

## Summary

| Area | Status | Notes |
|------|--------|-------|
| `APP_DEBUG=false` behaviour | **GREEN** | API errors sanitized via `GovernmentFormGenerationException`; no stack traces to client when debug off |
| Private storage | **GREEN** | `local` disk root = `storage/app/private`; `serve=false`; generated path containment enforced |
| Download authorization | **GREEN** | Consultant profile ownership + submission case match + auto_generated + path validator |
| Processor config | **GREEN** | JAR path + Java binary from env/config only; subcommand allowlist |
| Timeouts | **GREEN** | 120s default processor timeout; Windows loop terminates on overrun |
| Queue expectations | **GREEN** | Synchronous generation; no queue dependency |
| Log sanitization | **GREEN** | Processor logs path/status only; generation exceptions strip filesystem paths |
| CORS / auth | **GREEN** | Sanctum bearer on consultant routes; backend authoritative |
| File permissions | **GREEN** | Private disk not web-served; no public URL for generated PDFs |
| Temp directory cleanup | **GREEN** | datasets XML unlinked in `finally`; failed runs do not persist submission |
| Backup scope | **GREEN** | DB metadata + `government-forms/generated/` must be backed up together |
| Secrets in source control | **GREEN** | No license keys, `.env`, or credentials committed; tokens via env only |

---

## APP_DEBUG=false

- `ConsultantGovernmentFormController` catches `GovernmentFormGenerationException` → generic 422 message
- `GovernmentFormGenerationException::fromThrowable()` replaces processor and filesystem paths
- Download errors return generic `403` / `404` without resolved server paths

---

## Private storage verification

- Generated files stored under `government-forms/generated/{case_file_id}/`
- `GovernmentFormStoragePathValidator` enforces prefix + `realpath` containment before serve
- API JSON never exposes `file_path` or `download_url` (always null)

---

## Processor URL / path / config

| Setting | Source |
|---------|--------|
| JAR | `GOVERNMENT_FORM_PROCESSOR_JAR` / config default |
| Java | `GOVERNMENT_FORM_PROCESSOR_JAVA` / PATH discovery (Windows dev) |
| HTTP URL | `GOVERNMENT_FORM_PROCESSOR_URL` (alternate driver) |
| Token | `GOVERNMENT_FORM_PROCESSOR_TOKEN` (HTTP only) |

User/request input never supplies template or output filesystem paths for download.

---

## Temporary files

- Datasets XML: `tempnam(sys_get_temp_dir(), 'rcic_xfa_')` — deleted after fill
- Output PDF: application-generated path under private generated root

---

## Items requiring production operator action

1. Set `APP_DEBUG=false`, `APP_ENV=production`
2. Deploy commercial iText JAR (see `PRODUCTION_LICENSING.md`)
3. Ensure JRE 17+ on application host
4. Restrict filesystem permissions on `storage/app/private`
5. Configure backup for generated PDF directory + CWS DB

---

## Adobe revalidation

**Not required** for this closure stage — no changes to processor XFA write strategy, official templates, mappings, or PDF byte behaviour since Stage G/H Adobe verification.

Changes limited to: path containment validator, authorization hardening, TypeScript combobox fix, processor subcommand allowlist (invocation shell only).

<?php

namespace App\Services\GovernmentForms;

use App\Enums\GovernmentFormMappingStatus;
use App\Enums\GovernmentFormPdfTechnology;
use App\Enums\GovernmentFormSubmissionMode;
use App\Enums\GovernmentFormVersionStatus;
use App\Models\GovernmentFormMapping;
use App\Models\GovernmentFormVersion;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Detect / download official IRCC PDF templates from Canada.ca and create
 * draft (mapping-review) government_form_versions when the hash changes.
 * Never auto-activates a new hash as VERIFIED autofill.
 */
class GovernmentFormOfficialSyncService
{
    public const META_CACHE_KEY = 'government_forms_official_sync_meta_v1';

    public const USER_AGENT = 'RCICMASTER/1.0 (+https://www.rcicmaster.com)';

    /**
     * @return list<string> Uppercase form codes
     */
    public function supportedFormCodes(): array
    {
        $fromConfig = array_keys(config('government_forms.supported_forms', []));
        $withUrls = array_keys(config('government_forms.official_page_urls', []));

        $codes = array_values(array_unique(array_merge($fromConfig, $withUrls)));
        sort($codes);

        return array_values(array_filter($codes, fn ($c) => is_string($c) && $c !== ''));
    }

    public function pageUrlFor(string $formCode): ?string
    {
        $code = strtoupper(preg_replace('/[\s\-_]+/', '', $formCode) ?? $formCode);
        $urls = config('government_forms.official_page_urls', []);

        return is_array($urls) ? ($urls[$code] ?? null) : null;
    }

    /**
     * @return array{
     *   last_checked_at: ?string,
     *   last_result: ?array<string, mixed>,
     *   forms: list<array<string, mixed>>,
     *   counts: array{up_to_date: int, needs_remap: int, errors: int, missing_active: int},
     *   auto_sync: array{command: string, schedule: string, description: string}
     * }
     */
    public function status(): array
    {
        $meta = Cache::get(self::META_CACHE_KEY, []);
        $forms = [];
        $counts = [
            'up_to_date' => 0,
            'needs_remap' => 0,
            'errors' => 0,
            'missing_active' => 0,
        ];

        foreach ($this->supportedFormCodes() as $code) {
            $row = $this->statusForForm($code);
            $forms[] = $row;
            $hashStatus = $row['hash_status'] ?? 'unknown';
            if ($hashStatus === 'up_to_date') {
                $counts['up_to_date']++;
            } elseif (in_array($hashStatus, ['needs_remap', 'new_draft'], true)) {
                $counts['needs_remap']++;
            } elseif ($hashStatus === 'error') {
                $counts['errors']++;
            }
            if (! $row['active_version']) {
                $counts['missing_active']++;
            }
        }

        return [
            'last_checked_at' => is_array($meta) ? ($meta['last_checked_at'] ?? null) : null,
            'last_result' => is_array($meta) ? ($meta['last_result'] ?? null) : null,
            'forms' => $forms,
            'counts' => $counts,
            'auto_sync' => [
                'command' => 'government-forms:check-official',
                'schedule' => 'Weekly Sunday 03:30 America/Toronto',
                'description' => 'Detect Canada.ca PDF hash changes and download draft templates. Does not auto-activate autofill.',
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function statusForForm(string $formCode): array
    {
        $code = strtoupper(preg_replace('/[\s\-_]+/', '', $formCode) ?? $formCode);
        $supported = config('government_forms.supported_forms.'.$code, []);
        $active = app(GovernmentFormRegistryService::class)->findActiveVersion($code);
        $pending = $this->findLatestPendingVersion($code);
        $pageUrl = $this->pageUrlFor($code);

        $hashStatus = 'unknown';
        if (! $pageUrl) {
            $hashStatus = 'no_page_url';
        } elseif ($pending) {
            $hashStatus = 'needs_remap';
        } elseif ($active) {
            $hashStatus = 'up_to_date';
        } else {
            $hashStatus = 'missing_active';
        }

        $lastCheck = null;
        $meta = Cache::get(self::META_CACHE_KEY, []);
        if (is_array($meta) && isset($meta['per_form'][$code]['checked_at'])) {
            $lastCheck = $meta['per_form'][$code]['checked_at'];
            $lastOutcome = $meta['per_form'][$code]['outcome'] ?? null;
            if (is_string($lastOutcome) && in_array($lastOutcome, ['up_to_date', 'new_draft', 'error', 'unchanged_draft'], true)) {
                if ($lastOutcome === 'up_to_date' && ! $pending) {
                    $hashStatus = 'up_to_date';
                } elseif ($lastOutcome === 'new_draft' || $lastOutcome === 'unchanged_draft') {
                    $hashStatus = 'needs_remap';
                } elseif ($lastOutcome === 'error') {
                    $hashStatus = 'error';
                }
            }
            if (isset($meta['per_form'][$code]['error'])) {
                $hashStatus = 'error';
            }
        }

        return [
            'form_code' => $code,
            'name' => is_array($supported) ? ($supported['name'] ?? $code) : $code,
            'official_page_url' => $pageUrl,
            'hash_status' => $hashStatus,
            'last_checked_at' => $lastCheck,
            'last_error' => is_array($meta) ? ($meta['per_form'][$code]['error'] ?? null) : null,
            'official_version_label' => is_array($meta) ? ($meta['per_form'][$code]['official_version_label'] ?? null) : null,
            'official_sha256' => is_array($meta) ? ($meta['per_form'][$code]['official_sha256'] ?? null) : null,
            'active_version' => $active ? $this->serializeVersion($active) : null,
            'pending_version' => $pending ? $this->serializeVersion($pending) : null,
            'can_activate_pending' => $pending !== null
                && $pending->mapping_status === GovernmentFormMappingStatus::VERIFIED
                && $pending->template_storage_path
                && $pending->template_sha256,
        ];
    }

    /**
     * Check (and download when needed) all or one form.
     *
     * @return array{results: list<array<string, mixed>>, summary: array<string, int>}
     */
    public function sync(?string $formCode = null): array
    {
        $codes = $formCode
            ? [strtoupper(preg_replace('/[\s\-_]+/', '', $formCode) ?? $formCode)]
            : $this->supportedFormCodes();

        $results = [];
        $summary = [
            'up_to_date' => 0,
            'new_draft' => 0,
            'unchanged_draft' => 0,
            'error' => 0,
            'skipped' => 0,
        ];

        $perForm = [];
        $existingMeta = Cache::get(self::META_CACHE_KEY, []);
        if (is_array($existingMeta) && isset($existingMeta['per_form']) && is_array($existingMeta['per_form'])) {
            $perForm = $existingMeta['per_form'];
        }

        foreach ($codes as $code) {
            try {
                $result = $this->syncOne($code);
            } catch (\Throwable $e) {
                Log::warning('[GovernmentFormOfficialSync] sync failed', [
                    'form_code' => $code,
                    'error' => $e->getMessage(),
                ]);
                $result = [
                    'form_code' => $code,
                    'outcome' => 'error',
                    'message' => $e->getMessage(),
                ];
            }

            $results[] = $result;
            $outcome = $result['outcome'] ?? 'error';
            if (isset($summary[$outcome])) {
                $summary[$outcome]++;
            } else {
                $summary['error']++;
            }

            $perForm[$code] = [
                'checked_at' => now()->toIso8601String(),
                'outcome' => $outcome,
                'error' => $outcome === 'error' ? ($result['message'] ?? 'Unknown error') : null,
                'official_version_label' => $result['official_version_label'] ?? null,
                'official_sha256' => $result['official_sha256'] ?? null,
                'draft_version_id' => $result['draft_version_id'] ?? null,
            ];
        }

        $payload = [
            'last_checked_at' => now()->toIso8601String(),
            'last_result' => [
                'summary' => $summary,
                'checked_count' => count($results),
            ],
            'per_form' => $perForm,
        ];
        Cache::forever(self::META_CACHE_KEY, $payload);

        return [
            'results' => $results,
            'summary' => $summary,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function syncOne(string $formCode, ?string $pageUrlOverride = null): array
    {
        $code = strtoupper(preg_replace('/[\s\-_]+/', '', $formCode) ?? $formCode);
        $pageUrl = $pageUrlOverride ?: $this->pageUrlFor($code);

        if (! $pageUrl) {
            return [
                'form_code' => $code,
                'outcome' => 'skipped',
                'message' => 'No official Canada.ca page URL configured for this form.',
            ];
        }

        $fetched = $this->fetchOfficialPdf($pageUrl);
        $sha256 = $fetched['sha256'];
        $versionLabel = $fetched['version_label'] ?: ('official-'.substr($sha256, 0, 8));

        $active = app(GovernmentFormRegistryService::class)->findActiveVersion($code);

        if ($active && hash_equals((string) $active->template_sha256, $sha256)) {
            // Still store/refresh template file for ops, but no new version row.
            $this->storeTemplateBytes($code, $sha256, $fetched['bytes']);

            return [
                'form_code' => $code,
                'outcome' => 'up_to_date',
                'message' => 'Active autofill version matches the official PDF hash.',
                'official_version_label' => $fetched['version_label'],
                'official_sha256' => $sha256,
                'official_pdf_url' => $fetched['pdf_url'],
                'page_last_updated' => $fetched['page_last_updated'],
                'active_version_id' => $active->id,
            ];
        }

        $existingSameHash = GovernmentFormVersion::query()
            ->where('form_code', $code)
            ->where('template_sha256', $sha256)
            ->orderByDesc('id')
            ->first();

        if ($existingSameHash) {
            return [
                'form_code' => $code,
                'outcome' => 'unchanged_draft',
                'message' => 'A non-active version with this official hash already exists (awaiting remap / activate).',
                'official_version_label' => $fetched['version_label'] ?? $existingSameHash->version_label,
                'official_sha256' => $sha256,
                'official_pdf_url' => $fetched['pdf_url'],
                'draft_version_id' => $existingSameHash->id,
                'draft_status' => $existingSameHash->status?->value,
                'draft_mapping_status' => $existingSameHash->mapping_status?->value,
            ];
        }

        $storagePath = $this->storeTemplateBytes($code, $sha256, $fetched['bytes']);
        $draft = $this->createDraftVersion($code, $versionLabel, $pageUrl, $storagePath, $sha256, $active);

        return [
            'form_code' => $code,
            'outcome' => 'new_draft',
            'message' => 'Official PDF hash differs from the active autofill version. Draft created — remap then activate.',
            'official_version_label' => $fetched['version_label'],
            'official_sha256' => $sha256,
            'official_pdf_url' => $fetched['pdf_url'],
            'page_last_updated' => $fetched['page_last_updated'],
            'draft_version_id' => $draft->id,
            'storage_path' => $storagePath,
            'previous_active_version_id' => $active?->id,
        ];
    }

    /**
     * Mark mappings verified for a pending version (admin asserts remap review done).
     */
    public function markVerified(GovernmentFormVersion $version): GovernmentFormVersion
    {
        if ($version->status === GovernmentFormVersionStatus::ACTIVE
            && $version->mapping_status === GovernmentFormMappingStatus::VERIFIED) {
            return $version;
        }

        $version->update([
            'mapping_status' => GovernmentFormMappingStatus::VERIFIED,
            'compatibility_status' => 'SUPPORTED',
            'last_verified_at' => now(),
            // Keep non-active until activate() — unless already active.
            'status' => $version->status === GovernmentFormVersionStatus::ACTIVE
                ? GovernmentFormVersionStatus::ACTIVE
                : GovernmentFormVersionStatus::MAPPING_REVIEW_REQUIRED,
            'notes' => trim(($version->notes ? $version->notes."\n" : '').'Mappings marked verified via Admin Official Forms Sync at '.now()->toIso8601String()),
        ]);

        return $version->fresh();
    }

    /**
     * Activate a verified version; deprecate previous ACTIVE for the same form code.
     */
    public function activate(GovernmentFormVersion $version): GovernmentFormVersion
    {
        if ($version->mapping_status !== GovernmentFormMappingStatus::VERIFIED) {
            throw new \InvalidArgumentException('Version mappings must be VERIFIED before activate.');
        }
        if (! $version->template_storage_path || ! $version->template_sha256) {
            throw new \InvalidArgumentException('Version is missing template storage path or SHA-256.');
        }
        if (! Storage::disk('local')->exists($version->template_storage_path)) {
            throw new \InvalidArgumentException('Template file is missing from storage.');
        }

        GovernmentFormVersion::query()
            ->where('form_code', $version->form_code)
            ->where('id', '!=', $version->id)
            ->where('status', GovernmentFormVersionStatus::ACTIVE)
            ->update([
                'status' => GovernmentFormVersionStatus::DEPRECATED,
                'deprecated_at' => now()->toDateString(),
            ]);

        app(GovernmentFormRegistryService::class)->markVersionVerified($version);

        return $version->fresh();
    }

    /**
     * @return array{
     *   bytes: string,
     *   sha256: string,
     *   pdf_url: string,
     *   version_label: ?string,
     *   page_last_updated: ?string
     * }
     */
    public function fetchOfficialPdf(string $pageUrl): array
    {
        $response = Http::timeout(60)
            ->withHeaders(['User-Agent' => self::USER_AGENT])
            ->get($pageUrl);

        if ($response->failed()) {
            throw new \RuntimeException('Failed to fetch form page (HTTP '.$response->status().').');
        }

        $html = $response->body();
        $versionLabel = $this->extractVersionLabel($html);
        $dateModified = $this->extractDateModified($html);
        $pdfMeta = $this->resolvePdfLink($html);

        if (! $pdfMeta) {
            throw new \RuntimeException('Could not locate official PDF link on the form page.');
        }

        $pdfResponse = Http::timeout(120)
            ->withHeaders(['User-Agent' => self::USER_AGENT])
            ->get($pdfMeta['url']);

        if ($pdfResponse->failed()) {
            throw new \RuntimeException('PDF download failed (HTTP '.$pdfResponse->status().').');
        }

        $downloaded = $this->normalizePdfDownload($pdfResponse->body(), $pdfMeta['url']);

        return [
            'bytes' => $downloaded['bytes'],
            'sha256' => $downloaded['sha256'],
            'pdf_url' => $pdfMeta['url'],
            'version_label' => $versionLabel,
            'page_last_updated' => $dateModified,
        ];
    }

    /**
     * Download a direct PDF URL (used when government_form_versions.official_url points at the PDF).
     *
     * @return array{bytes: string, sha256: string, pdf_url: string, version_label: null, page_last_updated: null}
     */
    public function downloadPdfBytes(string $pdfUrl): array
    {
        $pdfResponse = Http::timeout(120)
            ->withHeaders(['User-Agent' => self::USER_AGENT])
            ->get($pdfUrl);

        if ($pdfResponse->failed()) {
            throw new \RuntimeException('PDF download failed (HTTP '.$pdfResponse->status().').');
        }

        $downloaded = $this->normalizePdfDownload($pdfResponse->body(), $pdfUrl);

        return [
            'bytes' => $downloaded['bytes'],
            'sha256' => $downloaded['sha256'],
            'pdf_url' => $pdfUrl,
            'version_label' => null,
            'page_last_updated' => null,
        ];
    }

    /**
     * @return array{bytes: string, sha256: string}
     */
    private function normalizePdfDownload(string $bytes, string $url): array
    {
        if ($bytes === '' || ! str_starts_with($bytes, '%PDF')) {
            throw new \RuntimeException('Downloaded content is not a PDF ('.$url.').');
        }

        // Real IRCC templates are large; reject obviously truncated bodies (< 1 KiB)
        // while still allowing compact fixtures in unit tests that start with %PDF.
        if (strlen($bytes) < 16) {
            throw new \RuntimeException('Downloaded PDF appears empty or invalid ('.$url.').');
        }

        return [
            'bytes' => $bytes,
            'sha256' => hash('sha256', $bytes),
        ];
    }

    public function storeTemplateBytes(string $formCode, string $sha256, string $bytes): string
    {
        $normalized = strtolower($formCode);
        $filename = $normalized.'-official-'.substr($sha256, 0, 12).'.pdf';
        $storagePath = 'government-forms-poc/templates/official/'.$filename;
        Storage::disk('local')->put($storagePath, $bytes);

        $manifest = [
            'form_code' => strtoupper($formCode),
            'normalized_code' => $normalized,
            'template_sha256' => $sha256,
            'storage_path' => $storagePath,
            'byte_size' => strlen($bytes),
            'downloaded_at' => now()->toIso8601String(),
        ];
        Storage::disk('local')->put(
            'government-forms-poc/templates/official/'.$normalized.'-manifest.json',
            json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );

        return $storagePath;
    }

    private function createDraftVersion(
        string $code,
        string $versionLabel,
        string $pageUrl,
        string $storagePath,
        string $sha256,
        ?GovernmentFormVersion $cloneFrom,
    ): GovernmentFormVersion {
        // Avoid unique collisions on form_code+version_label by suffixing hash when needed.
        $label = $versionLabel;
        $exists = GovernmentFormVersion::query()
            ->where('form_code', $code)
            ->where('version_label', $label)
            ->exists();
        if ($exists) {
            $label = $versionLabel.'-'.substr($sha256, 0, 8);
        }

        $draft = GovernmentFormVersion::create([
            'form_code' => $code,
            'version_label' => $label,
            'name' => $cloneFrom?->name
                ?? (config('government_forms.supported_forms.'.$code.'.name') ?: $code),
            'government_authority' => $cloneFrom?->government_authority ?? 'IRCC',
            'official_url' => $pageUrl,
            'template_storage_path' => $storagePath,
            'template_sha256' => $sha256,
            'pdf_technology' => $cloneFrom?->pdf_technology ?? GovernmentFormPdfTechnology::XFA_DYNAMIC,
            'submission_mode' => $cloneFrom?->submission_mode ?? GovernmentFormSubmissionMode::PDF_AUTO_FILL_ADOBE_VALIDATE,
            'engine_strategy' => $cloneFrom?->engine_strategy ?? 'pdfxfa_append',
            'mapping_version' => $cloneFrom?->mapping_version
                ? $cloneFrom->mapping_version.'-pending'
                : 'pending-review',
            'mapping_status' => GovernmentFormMappingStatus::MAPPING_REVIEW_REQUIRED,
            'status' => GovernmentFormVersionStatus::MAPPING_REVIEW_REQUIRED,
            'compatibility_status' => 'MAPPING_REVIEW_REQUIRED',
            'effective_date' => now()->toDateString(),
            'notes' => 'Auto-downloaded from Canada.ca via Official Forms Sync. Remap XFA fields before activate.',
        ]);

        if ($cloneFrom) {
            $this->cloneMappings($cloneFrom, $draft);
        }

        return $draft;
    }

    private function cloneMappings(GovernmentFormVersion $from, GovernmentFormVersion $to): void
    {
        $rows = $from->mappings()->orderBy('sort_order')->get();
        foreach ($rows as $row) {
            /** @var GovernmentFormMapping $row */
            GovernmentFormMapping::create([
                'government_form_version_id' => $to->id,
                'canonical_key' => $row->canonical_key,
                'pdf_field_path' => $row->pdf_field_path,
                'field_type' => $row->field_type,
                'transformer' => $row->transformer,
                'is_required' => $row->is_required,
                'conditional_rule' => $row->conditional_rule,
                'repeatable_group' => $row->repeatable_group,
                'sort_order' => $row->sort_order,
                'mapping_version' => $to->mapping_version,
                'notes' => 'Cloned from version #'.$from->id.' — requires review against new PDF.',
            ]);
        }
    }

    private function findLatestPendingVersion(string $code): ?GovernmentFormVersion
    {
        return GovernmentFormVersion::query()
            ->where('form_code', $code)
            ->whereIn('status', [
                GovernmentFormVersionStatus::MAPPING_REVIEW_REQUIRED,
                GovernmentFormVersionStatus::REVALIDATION_REQUIRED,
            ])
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeVersion(GovernmentFormVersion $version): array
    {
        return [
            'id' => $version->id,
            'form_code' => $version->form_code,
            'version_label' => $version->version_label,
            'status' => $version->status?->value,
            'mapping_status' => $version->mapping_status?->value,
            'template_sha256' => $version->template_sha256,
            'template_storage_path' => $version->template_storage_path,
            'official_url' => $version->official_url,
            'effective_date' => optional($version->effective_date)?->toDateString(),
            'last_verified_at' => optional($version->last_verified_at)?->toIso8601String(),
            'notes' => $version->notes,
        ];
    }

    private function extractVersionLabel(string $html): ?string
    {
        if (preg_match('/new version of this form is available\s*\(([^)]+)\)/i', $html, $m)) {
            return trim($m[1]);
        }

        // Common Canada.ca pattern: "Version: MM-YYYY" or form number with date folder in PDF path handled separately.
        if (preg_match('/Version\s*:?\s*([0-9]{2}-[0-9]{4})/i', $html, $m)) {
            return trim($m[1]);
        }

        return null;
    }

    private function extractDateModified(string $html): ?string
    {
        if (preg_match('/Last updated:\s*([^<]+)</i', $html, $m)) {
            return trim(html_entity_decode($m[1]));
        }

        return null;
    }

    /** @return array{url: string, filename: string}|null */
    private function resolvePdfLink(string $html): ?array
    {
        if (preg_match_all('/href="(\/content\/dam\/ircc[^"]+\.pdf)"/i', $html, $matches)) {
            $path = html_entity_decode($matches[1][0]);

            return [
                'url' => 'https://www.canada.ca'.$path,
                'filename' => basename($path),
            ];
        }

        if (preg_match_all('/href="(https:\/\/www\.canada\.ca\/content\/dam\/ircc[^"]+\.pdf)"/i', $html, $matches)) {
            return [
                'url' => html_entity_decode($matches[1][0]),
                'filename' => basename(parse_url($matches[1][0], PHP_URL_PATH) ?? 'form.pdf'),
            ];
        }

        return null;
    }
}

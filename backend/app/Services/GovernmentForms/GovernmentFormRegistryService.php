<?php

namespace App\Services\GovernmentForms;

use App\Enums\GovernmentFormMappingStatus;
use App\Enums\GovernmentFormVersionStatus;
use App\Models\GovernmentFormVersion;
use App\Models\IrccFormCatalog;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class GovernmentFormRegistryService
{
    public function findActiveVersion(string $formCode): ?GovernmentFormVersion
    {
        return GovernmentFormVersion::query()
            ->where('form_code', strtoupper($formCode))
            ->where('status', GovernmentFormVersionStatus::ACTIVE)
            ->where('mapping_status', GovernmentFormMappingStatus::VERIFIED)
            ->orderByDesc('effective_date')
            ->first();
    }

    public function findByFormAndVersion(string $formCode, string $versionLabel): ?GovernmentFormVersion
    {
        return GovernmentFormVersion::query()
            ->where('form_code', strtoupper($formCode))
            ->where('version_label', $versionLabel)
            ->first();
    }

    /**
     * When official template hash changes, mark version for mapping review.
     * Does NOT auto-activate new versions.
     */
    public function handleTemplateHashChange(GovernmentFormVersion $version, string $newSha256): void
    {
        if ($version->template_sha256 === $newSha256) {
            return;
        }

        $version->update([
            'template_sha256'     => $newSha256,
            'mapping_status'      => GovernmentFormMappingStatus::REVALIDATION_REQUIRED,
            'status'              => GovernmentFormVersionStatus::REVALIDATION_REQUIRED,
            'compatibility_status' => 'REVALIDATION_REQUIRED',
        ]);
    }

    public function markVersionVerified(GovernmentFormVersion $version): void
    {
        $version->update([
            'mapping_status'       => GovernmentFormMappingStatus::VERIFIED,
            'status'               => GovernmentFormVersionStatus::ACTIVE,
            'compatibility_status' => 'SUPPORTED',
            'last_verified_at'     => now(),
        ]);
    }

    public function resolveTemplateAbsolutePath(GovernmentFormVersion $version): ?string
    {
        if ($version->template_storage_path === null) {
            return null;
        }

        $disk = Storage::disk('local');

        if (! $disk->exists($version->template_storage_path)) {
            return null;
        }

        return $disk->path($version->template_storage_path);
    }

    /**
     * Resolve template path, downloading from Canada.ca when the private file is missing
     * but the official PDF still matches the version's expected SHA-256.
     *
     * @return array{path: ?string, error: ?string}
     */
    public function ensureTemplateAbsolutePath(GovernmentFormVersion $version): array
    {
        $existing = $this->resolveTemplateAbsolutePath($version);
        if ($existing !== null) {
            return ['path' => $existing, 'error' => null];
        }

        $expectedSha = $version->template_sha256;
        $formCode = strtoupper((string) $version->form_code);

        try {
            $sync = app(GovernmentFormOfficialSyncService::class);
            $officialUrl = is_string($version->official_url) ? trim($version->official_url) : '';
            $pageUrl = $officialUrl !== '' ? $officialUrl : ($sync->pageUrlFor($formCode) ?? '');

            if ($pageUrl === '') {
                return [
                    'path' => null,
                    'error' => 'Official template is missing from private storage and no Canada.ca page URL is configured for '.$formCode.'.',
                ];
            }

            // Seeded versions often store a direct PDF URL in official_url.
            if (preg_match('/\.pdf($|\?)/i', $pageUrl)) {
                $fetched = $sync->downloadPdfBytes($pageUrl);
            } else {
                $fetched = $sync->fetchOfficialPdf($pageUrl);
            }
            $sha = $fetched['sha256'];
            $bytes = $fetched['bytes'];

            if (is_string($expectedSha) && $expectedSha !== '' && ! hash_equals($expectedSha, $sha)) {
                // Direct archived URL may 404 / redirect; fall back to live form page once.
                $livePage = $sync->pageUrlFor($formCode);
                if ($livePage && $livePage !== $pageUrl) {
                    $fetched = $sync->fetchOfficialPdf($livePage);
                    $sha = $fetched['sha256'];
                    $bytes = $fetched['bytes'];
                }
            }

            if (is_string($expectedSha) && $expectedSha !== '' && ! hash_equals($expectedSha, $sha)) {
                Log::warning('[GovernmentForms] Official PDF hash differs from active version; refusing to auto-use', [
                    'form_code' => $formCode,
                    'expected' => $expectedSha,
                    'fetched' => $sha,
                ]);

                return [
                    'path' => null,
                    'error' => 'Official Canada.ca PDF has changed since this autofill version was verified (hash mismatch). Run Admin → Official Forms Sync, remap, then activate.',
                ];
            }

            $relative = $version->template_storage_path
                ?: ('government-forms-poc/templates/official/'.strtolower($formCode).'-official-'.substr($sha, 0, 12).'.pdf');

            Storage::disk('local')->put($relative, $bytes);

            if ($version->template_storage_path !== $relative || $version->template_sha256 !== $sha) {
                $version->update([
                    'template_storage_path' => $relative,
                    'template_sha256' => $sha,
                    'official_url' => $officialUrl !== '' ? $officialUrl : $pageUrl,
                ]);
                $version->refresh();
            }

            $path = Storage::disk('local')->path($relative);
            if (! is_file($path)) {
                return [
                    'path' => null,
                    'error' => 'Official template download succeeded but the file is still not readable in private storage.',
                ];
            }

            Log::info('[GovernmentForms] Restored missing official template from Canada.ca', [
                'form_code' => $formCode,
                'path' => $relative,
                'sha256' => $sha,
            ]);

            return ['path' => $path, 'error' => null];
        } catch (\Throwable $e) {
            Log::warning('[GovernmentForms] Failed to restore official template', [
                'form_code' => $formCode,
                'error' => $e->getMessage(),
            ]);

            return [
                'path' => null,
                'error' => 'Official template is not available in private storage (auto-download failed: '.$e->getMessage().').',
            ];
        }
    }

    /**
     * Ensure every ACTIVE+VERIFIED version has its template file on disk.
     *
     * @return array{restored: int, already_present: int, failed: list<array{form_code: string, message: string}>}
     */
    public function ensureAllActiveTemplates(): array
    {
        $versions = GovernmentFormVersion::query()
            ->where('status', GovernmentFormVersionStatus::ACTIVE)
            ->where('mapping_status', GovernmentFormMappingStatus::VERIFIED)
            ->get();

        $restored = 0;
        $already = 0;
        $failed = [];

        foreach ($versions as $version) {
            if ($this->resolveTemplateAbsolutePath($version) !== null) {
                $already++;
                continue;
            }

            $result = $this->ensureTemplateAbsolutePath($version);
            if ($result['path'] !== null) {
                $restored++;
            } else {
                $failed[] = [
                    'form_code' => $version->form_code,
                    'message' => $result['error'] ?? 'Unknown error',
                ];
            }
        }

        return [
            'restored' => $restored,
            'already_present' => $already,
            'failed' => $failed,
        ];
    }

    public function linkToCatalog(GovernmentFormVersion $version): void
    {
        if ($version->ircc_form_catalog_id !== null) {
            return;
        }

        $catalog = IrccFormCatalog::where('normalized_code', strtolower($version->form_code))->first();

        if ($catalog) {
            $version->update(['ircc_form_catalog_id' => $catalog->id]);
        }
    }
}

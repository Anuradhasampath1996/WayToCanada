<?php

namespace App\Services\GovernmentForms;

use App\Enums\GovernmentFormMappingStatus;
use App\Enums\GovernmentFormVersionStatus;
use App\Models\GovernmentFormVersion;
use App\Models\IrccFormCatalog;
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

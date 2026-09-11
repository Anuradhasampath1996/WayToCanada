<?php

namespace Tests\Unit\GovernmentForms;

use App\Enums\GovernmentFormMappingStatus;
use App\Enums\GovernmentFormPdfTechnology;
use App\Enums\GovernmentFormSubmissionMode;
use App\Enums\GovernmentFormVersionStatus;
use App\Models\GovernmentFormMapping;
use App\Models\GovernmentFormVersion;
use App\Services\GovernmentForms\GovernmentFormOfficialSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class GovernmentFormOfficialSyncServiceTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesLmsDatabase;

    private GovernmentFormOfficialSyncService $sync;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wipeLmsTestDatabase();
        Storage::fake('local');
        Cache::forget(GovernmentFormOfficialSyncService::META_CACHE_KEY);
        $this->sync = app(GovernmentFormOfficialSyncService::class);
    }

    public function test_matching_hash_is_up_to_date_and_does_not_create_draft(): void
    {
        $pdfBytes = '%PDF-1.4 official-same-content';
        $sha = hash('sha256', $pdfBytes);

        $active = $this->createActiveVersion('IMM5476', '11-2025', $sha);
        $this->fakeOfficialFetch($pdfBytes, '11-2025');

        $before = GovernmentFormVersion::where('form_code', 'IMM5476')->count();
        $result = $this->sync->syncOne('IMM5476');

        $this->assertSame('up_to_date', $result['outcome']);
        $this->assertSame($active->id, $result['active_version_id']);
        $this->assertSame($before, GovernmentFormVersion::where('form_code', 'IMM5476')->count());
        $this->assertSame(
            GovernmentFormVersionStatus::ACTIVE,
            $active->fresh()->status
        );
    }

    public function test_hash_change_creates_mapping_review_draft_not_active(): void
    {
        $oldBytes = '%PDF-1.4 old-template-bytes';
        $newBytes = '%PDF-1.4 new-official-template-bytes!!';
        $oldSha = hash('sha256', $oldBytes);
        $newSha = hash('sha256', $newBytes);

        $active = $this->createActiveVersion('IMM0008', '05-2026', $oldSha);
        GovernmentFormMapping::create([
            'government_form_version_id' => $active->id,
            'canonical_key' => 'applicant.personal.family_name',
            'pdf_field_path' => 'form1.FamilyName[0]',
            'field_type' => 'text',
            'transformer' => 'name',
            'is_required' => true,
            'sort_order' => 1,
            'mapping_version' => '1.0.0',
        ]);

        $this->fakeOfficialFetch($newBytes, '06-2026');

        $result = $this->sync->syncOne('IMM0008');

        $this->assertSame('new_draft', $result['outcome']);
        $this->assertNotEmpty($result['draft_version_id']);

        $draft = GovernmentFormVersion::findOrFail($result['draft_version_id']);
        $this->assertSame($newSha, $draft->template_sha256);
        $this->assertSame(GovernmentFormVersionStatus::MAPPING_REVIEW_REQUIRED, $draft->status);
        $this->assertSame(GovernmentFormMappingStatus::MAPPING_REVIEW_REQUIRED, $draft->mapping_status);
        $this->assertNotSame(GovernmentFormVersionStatus::ACTIVE, $draft->status);

        // Previous active stays active until explicit activate.
        $this->assertSame(GovernmentFormVersionStatus::ACTIVE, $active->fresh()->status);
        $this->assertSame(GovernmentFormMappingStatus::VERIFIED, $active->fresh()->mapping_status);

        // Mappings cloned for review.
        $this->assertSame(1, $draft->mappings()->count());
    }

    public function test_activate_requires_verified_mappings(): void
    {
        $bytes = '%PDF-1.4 pending';
        $sha = hash('sha256', $bytes);
        Storage::disk('local')->put('government-forms-poc/templates/official/imm0008-test.pdf', $bytes);

        $draft = GovernmentFormVersion::create([
            'form_code' => 'IMM0008',
            'version_label' => 'pending-test',
            'name' => 'Generic Application Form for Canada',
            'government_authority' => 'IRCC',
            'official_url' => 'https://www.canada.ca/example',
            'template_storage_path' => 'government-forms-poc/templates/official/imm0008-test.pdf',
            'template_sha256' => $sha,
            'pdf_technology' => GovernmentFormPdfTechnology::XFA_DYNAMIC,
            'submission_mode' => GovernmentFormSubmissionMode::PDF_AUTO_FILL_ADOBE_VALIDATE,
            'engine_strategy' => 'pdfxfa_append',
            'mapping_version' => 'pending',
            'mapping_status' => GovernmentFormMappingStatus::MAPPING_REVIEW_REQUIRED,
            'status' => GovernmentFormVersionStatus::MAPPING_REVIEW_REQUIRED,
            'compatibility_status' => 'MAPPING_REVIEW_REQUIRED',
            'effective_date' => now()->toDateString(),
        ]);

        $this->expectException(\InvalidArgumentException::class);
        $this->sync->activate($draft);
    }

    public function test_activate_after_mark_verified_deprecates_previous_active(): void
    {
        $oldBytes = '%PDF-1.4 old';
        $newBytes = '%PDF-1.4 newer-content';
        $oldSha = hash('sha256', $oldBytes);
        $newSha = hash('sha256', $newBytes);

        $active = $this->createActiveVersion('IMM5669', '05-2021', $oldSha);
        Storage::disk('local')->put('government-forms-poc/templates/official/imm5669-new.pdf', $newBytes);

        $draft = GovernmentFormVersion::create([
            'form_code' => 'IMM5669',
            'version_label' => '06-2026-draft',
            'name' => 'Schedule A',
            'government_authority' => 'IRCC',
            'official_url' => 'https://www.canada.ca/example',
            'template_storage_path' => 'government-forms-poc/templates/official/imm5669-new.pdf',
            'template_sha256' => $newSha,
            'pdf_technology' => GovernmentFormPdfTechnology::XFA_DYNAMIC,
            'submission_mode' => GovernmentFormSubmissionMode::PDF_AUTO_FILL_ADOBE_VALIDATE,
            'engine_strategy' => 'pdfxfa_append',
            'mapping_version' => 'pending',
            'mapping_status' => GovernmentFormMappingStatus::MAPPING_REVIEW_REQUIRED,
            'status' => GovernmentFormVersionStatus::MAPPING_REVIEW_REQUIRED,
            'compatibility_status' => 'MAPPING_REVIEW_REQUIRED',
            'effective_date' => now()->toDateString(),
        ]);

        $this->sync->markVerified($draft);
        $activated = $this->sync->activate($draft->fresh());

        $this->assertSame(GovernmentFormVersionStatus::ACTIVE, $activated->status);
        $this->assertSame(GovernmentFormMappingStatus::VERIFIED, $activated->mapping_status);
        $this->assertSame(GovernmentFormVersionStatus::DEPRECATED, $active->fresh()->status);
    }

    private function createActiveVersion(string $formCode, string $label, string $sha): GovernmentFormVersion
    {
        $path = 'government-forms-poc/templates/official/'.strtolower($formCode).'-active.pdf';
        Storage::disk('local')->put($path, 'placeholder');

        return GovernmentFormVersion::create([
            'form_code' => $formCode,
            'version_label' => $label,
            'name' => $formCode,
            'government_authority' => 'IRCC',
            'official_url' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/'.strtolower($formCode).'.html',
            'template_storage_path' => $path,
            'template_sha256' => $sha,
            'pdf_technology' => GovernmentFormPdfTechnology::XFA_DYNAMIC,
            'submission_mode' => GovernmentFormSubmissionMode::PDF_AUTO_FILL_ADOBE_VALIDATE,
            'engine_strategy' => 'pdfxfa_append',
            'mapping_version' => '1.0.0',
            'mapping_status' => GovernmentFormMappingStatus::VERIFIED,
            'status' => GovernmentFormVersionStatus::ACTIVE,
            'compatibility_status' => 'SUPPORTED',
            'effective_date' => now()->toDateString(),
            'last_verified_at' => now(),
        ]);
    }

    private function fakeOfficialFetch(string $pdfBytes, string $versionLabel): void
    {
        $pageHtml = <<<HTML
        <html><body>
          <p>A new version of this form is available ({$versionLabel})</p>
          <p>Last updated: September 11, 2026</p>
          <a href="/content/dam/ircc/documents/pdf/english/kits/forms/imm-test.pdf">PDF</a>
        </body></html>
        HTML;

        Http::fake([
            'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/*' => Http::response($pageHtml, 200),
            'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm-test.pdf' => Http::response($pdfBytes, 200),
        ]);
    }
}

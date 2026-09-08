<?php

namespace Tests\Feature\GovernmentForms;

use App\Models\IrccPackageDocumentSubmission;
use App\Services\GovernmentForms\GovernmentFormStoragePathValidator;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Filesystem\FileNotFoundException;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CreatesGovernmentFormFixtures;
use Tests\TestCase;

class GovernmentFormsProductionReadinessTest extends TestCase
{
    use CreatesGovernmentFormFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedGovernmentFormRoles();
        $this->seedGovernmentFormVersions();
    }

    #[DataProvider('invalidGeneratedPathProvider')]
    public function test_generated_path_validator_rejects_unsafe_paths(string $path): void
    {
        $validator = app(GovernmentFormStoragePathValidator::class);

        $this->expectException(AuthorizationException::class);
        $validator->resolveGeneratedPath($path);
    }

    public static function invalidGeneratedPathProvider(): array
    {
        return [
            'parent_unix' => ['../etc/passwd'],
            'parent_windows' => ['..\\windows\\system32\\config\\sam'],
            'encoded_traversal' => ['government-forms/generated/%2e%2e/private/secret.pdf'],
            'absolute_unix' => ['/etc/passwd'],
            'absolute_windows' => ['C:\\Windows\\System32\\drivers\\etc\\hosts'],
            'mixed_separators' => ['government-forms\\generated\\..\\templates\\imm5476.pdf'],
            'templates_directory' => ['government-forms/templates/official/imm5476-official.pdf'],
            'application_packages' => ['application-packages/other-client/secret.pdf'],
            'null_byte' => ["government-forms/generated/test.pdf\0.extra"],
        ];
    }

    public function test_valid_generated_path_is_accepted(): void
    {
        Storage::fake('local');
        $relative = 'government-forms/generated/42/IMM5476-valid.pdf';
        Storage::disk('local')->put($relative, '%PDF-1.4 test');

        $resolved = app(GovernmentFormStoragePathValidator::class)->resolveGeneratedPath($relative);

        $this->assertSame($relative, $resolved);
    }

    public function test_download_rejects_paths_outside_generated_root(): void
    {
        $this->ensureImm5476Template();
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();
        $submissionId = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")->json('submission.id');
        if (! $submissionId) {
            $this->markTestSkipped('Generation unavailable.');
        }

        $submission = IrccPackageDocumentSubmission::findOrFail($submissionId);
        $submission->update(['file_path' => 'government-forms/templates/official/evil.pdf']);

        $this->get("/api/v1/consultant/clients/{$profile->id}/government-forms/generations/{$submissionId}/download")
            ->assertForbidden();
    }

    public function test_download_accepts_valid_private_generated_path(): void
    {
        $this->ensureImm5476Template();
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();
        $submissionId = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")->json('submission.id');
        if (! $submissionId) {
            $this->markTestSkipped('Generation unavailable.');
        }

        $this->get("/api/v1/consultant/clients/{$profile->id}/government-forms/generations/{$submissionId}/download?download=1")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_template_preview_returns_official_blank_pdf(): void
    {
        $this->ensureImm5476Template();
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $this->get("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/template-preview")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_template_preview_rejects_unknown_form_code(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $this->get("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM9999/template-preview")
            ->assertNotFound();
    }

    public function test_template_path_validator_rejects_generated_root(): void
    {
        $validator = app(GovernmentFormStoragePathValidator::class);

        $this->expectException(AuthorizationException::class);
        $validator->resolveTemplatePath('government-forms/generated/42/evil.pdf');
    }

    public function test_valid_template_path_is_accepted(): void
    {
        Storage::fake('local');
        $relative = 'government-forms/templates/official/imm5476-official.pdf';
        Storage::disk('local')->put($relative, '%PDF-1.4 template');

        $resolved = app(GovernmentFormStoragePathValidator::class)->resolveTemplatePath($relative);

        $this->assertSame($relative, $resolved);
    }

    public function test_poc_template_path_is_accepted(): void
    {
        Storage::fake('local');
        $relative = 'government-forms-poc/templates/official/imm5476-official-aca5c476b93d.pdf';
        Storage::disk('local')->put($relative, '%PDF-1.4 template');

        $resolved = app(GovernmentFormStoragePathValidator::class)->resolveTemplatePath($relative);

        $this->assertSame($relative, $resolved);
    }

    public function test_missing_generated_file_returns_not_found(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $relative = 'government-forms/generated/'.$profile->caseFile->id.'/missing.pdf';
        $submission = IrccPackageDocumentSubmission::create([
            'case_file_id' => $profile->caseFile->id,
            'uploaded_by' => $consultant->id,
            'file_path' => $relative,
            'original_filename' => 'IMM5476-11-2025.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'generated',
            'generation_type' => 'auto_generated',
            'generation_status' => 'GENERATED',
            'storage_disk' => 'local',
        ]);

        $this->expectException(FileNotFoundException::class);
        app(GovernmentFormStoragePathValidator::class)->resolveGeneratedPath($relative);
    }
}

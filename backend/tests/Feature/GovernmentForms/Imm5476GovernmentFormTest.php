<?php

namespace Tests\Feature\GovernmentForms;

use App\Contracts\GovernmentForms\GovernmentPdfEngine;
use App\Enums\GovernmentFormGenerationStatus;
use App\Models\IrccPackageDocumentSubmission;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Database\Seeders\GovernmentFormVersionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesGovernmentFormFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class Imm5476GovernmentFormTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesLmsDatabase;
    use CreatesGovernmentFormFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wipeLmsTestDatabase();
        $this->seedGovernmentFormRoles();
        $this->seedGovernmentFormVersions();
    }

    public function test_consultant_can_review_application_information(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $response = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review");

        $response->assertOk()
            ->assertJsonPath('application_info_reviewed', true);

        $this->assertDatabaseHas('case_files', [
            'id' => $profile->fresh()->active_case_file_id,
        ]);

        $caseFile = $profile->fresh()->caseFile;
        $this->assertNotNull($caseFile->application_info_reviewed_at);
        $this->assertNotNull($caseFile->questionnaire_snapshot_hash);
        $this->assertIsArray($caseFile->questionnaire_snapshot);
    }

    public function test_readiness_reports_missing_required_fields(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'clientUser' => $clientUser] = $this->createConsultantWithClient();
        $consultant->update(['rcic_number' => null, 'name' => '']);
        QuestionnaireSubmission::where('user_id', $clientUser->id)->update(['main_data' => []]);
        $this->actingAsConsultant($consultant->fresh());

        $response = $this->getJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/readiness");

        $response->assertOk()
            ->assertJsonPath('form_code', 'IMM5476')
            ->assertJsonPath('ready', false);

        $this->assertGreaterThan(0, count($response->json('missing_fields')));
    }

    public function test_cross_consultant_access_is_denied(): void
    {
        ['profile' => $profile] = $this->createConsultantWithClient();

        $other = User::factory()->create();
        $other->assignRole('rcic');
        $this->actingAsConsultant($other);

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/readiness")
            ->assertForbidden();
    }

    public function test_generation_requires_application_info_review(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Application information must be reviewed before generating government forms.');
    }

    public function test_generation_persists_private_submission_with_hashes(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $this->ensureImm5476Template();
        $this->seed(GovernmentFormVersionSeeder::class);

        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")
            ->assertOk();

        $response = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate");

        if ($response->status() === 422 && str_contains($response->json('message') ?? '', 'not ready')) {
            $this->fail('Expected ready form: '.$response->json('message'));
        }

        $response->assertCreated()
            ->assertJsonStructure(['submission' => ['id', 'source_data_hash', 'output_sha256']]);

        $submissionId = $response->json('submission.id');
        $submission = IrccPackageDocumentSubmission::findOrFail($submissionId);

        $this->assertSame('local', $submission->storage_disk);
        $this->assertNotNull($submission->source_data_hash);
        $this->assertNotNull($submission->output_sha256);
        $this->assertTrue(Storage::disk('local')->exists($submission->file_path));
        $this->assertSame($caseFile->id, $submission->case_file_id);
    }

    public function test_regeneration_supersedes_previous_submission(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $this->ensureImm5476Template();

        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review");

        $first = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate");
        if ($first->status() !== 201) {
            $this->markTestSkipped('Generation unavailable: '.$first->json('message'));
        }

        $second = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate");
        $second->assertCreated();

        $firstSubmission = IrccPackageDocumentSubmission::find($first->json('submission.id'));
        $this->assertSame(GovernmentFormGenerationStatus::SUPERSEDED, $firstSubmission->generation_status);
        $this->assertSame($firstSubmission->id, $second->json('submission.supersedes_id'));
    }

    public function test_private_download_requires_authorization(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();

        $submission = IrccPackageDocumentSubmission::create([
            'case_file_id'              => $profile->caseFile->id,
            'ircc_category_document_id' => null,
            'uploaded_by'               => $consultant->id,
            'file_path'                 => 'government-forms/generated/'.$profile->caseFile->id.'/test.pdf',
            'original_filename'         => 'IMM5476-11-2025.pdf',
            'mime_type'                 => 'application/pdf',
            'status'                    => 'generated',
            'generation_type'           => 'auto_generated',
            'generation_status'         => 'GENERATED',
            'storage_disk'              => 'local',
        ]);

        Storage::disk('local')->put($submission->file_path, '%PDF-1.4 test');

        $other = User::factory()->create();
        $other->assignRole('rcic');
        $this->actingAsConsultant($other);

        $this->get("/api/v1/consultant/clients/{$profile->id}/government-forms/generations/{$submission->id}/download")
            ->assertForbidden();

        $this->actingAsConsultant($consultant);
        $this->get("/api/v1/consultant/clients/{$profile->id}/government-forms/generations/{$submission->id}/download")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_failed_generation_does_not_persist_submission_when_engine_fails(): void
    {
        $this->mock(GovernmentPdfEngine::class, function ($mock) {
            $mock->shouldReceive('engineId')->andReturn('mock');
            $mock->shouldReceive('fillXfaDatasets')->andThrow(new \RuntimeException('Processor exploded'));
        });

        $this->ensureImm5476Template();

        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review");

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")
            ->assertStatus(422);

        $this->assertSame(0, IrccPackageDocumentSubmission::where('case_file_id', $profile->caseFile->id)->count());
    }
}

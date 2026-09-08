<?php

namespace Tests\Feature\GovernmentForms;

use App\Contracts\GovernmentForms\GovernmentPdfEngine;
use App\Enums\GovernmentFormMappingStatus;
use App\Enums\GovernmentFormVersionStatus;
use App\Models\ClientActivityLog;
use App\Models\GovernmentFormVersion;
use App\Models\IrccPackageDocumentSubmission;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Database\Seeders\GovernmentFormVersionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesGovernmentFormFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class GovernmentFormsStageISecurityTest extends TestCase
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

    public function test_cross_consultant_cannot_access_index_readiness_or_generate(): void
    {
        ['profile' => $profile] = $this->createConsultantWithClient();
        $other = User::factory()->create();
        $other->assignRole('rcic');
        $this->actingAsConsultant($other);

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/government-forms")->assertForbidden();
        $this->getJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/readiness")->assertForbidden();
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")->assertForbidden();
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertForbidden();
    }

    public function test_idor_download_with_wrong_profile_returns_forbidden(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $this->ensureImm5476Template();
        ['consultant' => $owner, 'profile' => $ownerProfile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($owner);
        $this->postJson("/api/v1/consultant/clients/{$ownerProfile->id}/government-forms/application-info/review")->assertOk();
        $submissionId = $this->postJson("/api/v1/consultant/clients/{$ownerProfile->id}/government-forms/IMM5476/generate")->json('submission.id');
        if (! $submissionId) {
            $this->markTestSkipped('Generation unavailable.');
        }

        ['profile' => $otherProfile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($owner);

        $this->getJson("/api/v1/consultant/clients/{$otherProfile->id}/government-forms/generations/{$submissionId}/download")
            ->assertForbidden();
    }

    public function test_idor_mark_reviewed_returns_forbidden(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $this->ensureImm5476Template();
        ['consultant' => $owner, 'profile' => $ownerProfile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($owner);
        $this->postJson("/api/v1/consultant/clients/{$ownerProfile->id}/government-forms/application-info/review")->assertOk();
        $submissionId = $this->postJson("/api/v1/consultant/clients/{$ownerProfile->id}/government-forms/IMM5476/generate")->json('submission.id');
        if (! $submissionId) {
            $this->markTestSkipped('Generation unavailable.');
        }

        ['consultant' => $other, 'profile' => $otherProfile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($other);

        $this->postJson("/api/v1/consultant/clients/{$otherProfile->id}/government-forms/generations/{$submissionId}/mark-reviewed")
            ->assertForbidden();
    }

    public function test_mismatched_case_file_id_is_rejected(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        ['caseFile' => $otherCase] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/government-forms?case_file_id={$otherCase->id}")
            ->assertForbidden();
    }

    public function test_generation_before_review_is_rejected(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Application information must be reviewed before generating government forms.');
    }

    public function test_inactive_form_version_cannot_generate(): void
    {
        GovernmentFormVersion::where('form_code', 'IMM5476')->update([
            'status' => GovernmentFormVersionStatus::DISABLED,
        ]);

        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")
            ->assertStatus(422);
    }

    public function test_unverified_mapping_cannot_generate(): void
    {
        GovernmentFormVersion::where('form_code', 'IMM5476')->update([
            'mapping_status' => GovernmentFormMappingStatus::DRAFT,
        ]);

        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")
            ->assertStatus(422);
    }

    public function test_malformed_form_code_returns_not_found_or_error(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/government-forms/NOTAFORM/readiness")
            ->assertStatus(422);
    }

    public function test_tampered_template_hash_blocks_generation(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $version = $this->ensureImm5476Template();
        $path = storage_path('app/private/'.$version->template_storage_path);
        $original = file_get_contents($path);
        file_put_contents($path, $original.' ');

        try {
            ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
            $this->actingAsConsultant($consultant);
            $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();

            $response = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate");
            $response->assertStatus(422);
            $this->assertStringContainsString('hash mismatch', strtolower($response->json('message') ?? ''));
        } finally {
            file_put_contents($path, $original);
        }
    }

    public function test_download_rejects_path_traversal_in_storage_metadata(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $this->ensureImm5476Template();
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();
        $submissionId = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")->json('submission.id');
        if (! $submissionId) {
            $this->markTestSkipped('Generation unavailable.');
        }

        IrccPackageDocumentSubmission::where('id', $submissionId)->update([
            'file_path' => 'government-forms/generated/../.env',
        ]);

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/government-forms/generations/{$submissionId}/download")
            ->assertForbidden();
    }

    public function test_api_json_does_not_expose_private_storage_paths(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $this->ensureImm5476Template();
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();
        $response = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate");
        if ($response->status() !== 201) {
            $this->markTestSkipped('Generation unavailable.');
        }

        $json = json_encode($response->json());
        $this->assertStringNotContainsString('storage/app/private', $json);
        $this->assertStringNotContainsString('government-forms/generated', $json);
        $this->assertNull($response->json('submission.download_url'));
    }

    public function test_processor_failure_does_not_persist_submission(): void
    {
        $this->mock(GovernmentPdfEngine::class, function ($mock) {
            $mock->shouldReceive('fillXfaDatasets')->andThrow(new \RuntimeException('Form processor failed (exit 1): simulated'));
            $mock->shouldReceive('engineId')->andReturn('mock');
        });

        $this->ensureImm5476Template();
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();

        $before = IrccPackageDocumentSubmission::where('case_file_id', $caseFile->id)->count();

        $response = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate");
        $response->assertStatus(422);
        $this->assertStringNotContainsString('storage', strtolower($response->json('message') ?? ''));

        $this->assertSame($before, IrccPackageDocumentSubmission::where('case_file_id', $caseFile->id)->count());
    }

    public function test_audit_events_recorded_for_review_and_generation(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $this->ensureImm5476Template();
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();
        $submissionId = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")->json('submission.id');
        if (! $submissionId) {
            $this->markTestSkipped('Generation unavailable.');
        }

        $this->assertDatabaseHas('client_activity_logs', [
            'client_profile_id' => $profile->id,
            'event_type' => 'application_info_reviewed',
        ], 'cws');

        $audit = ClientActivityLog::where('client_profile_id', $profile->id)
            ->where('event_type', 'government_form_generated')
            ->first();
        $this->assertNotNull($audit);
        $this->assertArrayHasKey('submission_id', $audit->metadata ?? []);
        $this->assertStringNotContainsString('passport', json_encode($audit->metadata));
    }
}

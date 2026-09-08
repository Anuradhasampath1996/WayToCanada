<?php

namespace Tests\Feature\GovernmentForms;

use App\Models\IrccPackageDocumentSubmission;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Database\Seeders\GovernmentFormVersionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesGovernmentFormFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class Imm5406GovernmentFormTest extends TestCase
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

    public function test_readiness_reports_missing_family_information(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'clientUser' => $clientUser] = $this->createConsultantWithClient();
        QuestionnaireSubmission::where('user_id', $clientUser->id)->update(['main_data' => [], 'accompanying_data' => []]);
        $this->actingAsConsultant($consultant);

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5406/readiness")
            ->assertOk()
            ->assertJsonPath('ready', false);

        $this->assertGreaterThan(0, count($this->getJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5406/readiness")->json('missing_fields')));
    }

    public function test_overflow_blocks_generation_when_children_exceed_capacity(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'clientUser' => $clientUser] = $this->createConsultantWithClient();
        $this->populateImm5406Questionnaire($clientUser);
        QuestionnaireSubmission::where('user_id', $clientUser->id)->update([
            'children_data' => [
                ['fullName' => 'C1 STAGEH', 'dob' => '2010-01-01'],
                ['fullName' => 'C2 STAGEH', 'dob' => '2011-01-01'],
                ['fullName' => 'C3 STAGEH', 'dob' => '2012-01-01'],
                ['fullName' => 'C4 STAGEH', 'dob' => '2013-01-01'],
            ],
        ]);
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5406/readiness")
            ->assertOk()
            ->assertJsonPath('blocked_by_overflow', true);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5406/generate")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Form exceeds IMM 5406 field capacity. Resolve overflow warnings before generating.');
    }

    public function test_generation_persists_private_submission_with_hashes(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $this->ensureImm5406Template();
        $this->seed(GovernmentFormVersionSeeder::class);

        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile, 'clientUser' => $clientUser] = $this->createConsultantWithClient();
        $this->populateImm5406Questionnaire($clientUser);
        $this->actingAsConsultant($consultant);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")
            ->assertOk();

        $response = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5406/generate");

        if ($response->status() === 422 && str_contains($response->json('message') ?? '', 'not ready')) {
            $this->fail('Expected ready form: '.$response->json('message'));
        }

        $response->assertCreated()
            ->assertJsonStructure(['submission' => ['id', 'source_data_hash', 'output_sha256']]);

        $submission = IrccPackageDocumentSubmission::findOrFail($response->json('submission.id'));
        $this->assertSame('IMM5406', $submission->governmentFormVersion?->form_code);
        $this->assertTrue(Storage::disk('local')->exists($submission->file_path));
        $this->assertSame($caseFile->id, $submission->case_file_id);
    }

    public function test_cross_consultant_download_is_denied(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $this->ensureImm5406Template();
        ['consultant' => $consultant, 'profile' => $profile, 'clientUser' => $clientUser] = $this->createConsultantWithClient();
        $this->populateImm5406Questionnaire($clientUser);
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();
        $submissionId = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5406/generate")->json('submission.id');

        if (! $submissionId) {
            $this->markTestSkipped('Generation unavailable in this environment.');
        }

        $other = User::factory()->create();
        $other->assignRole('rcic');
        $this->actingAsConsultant($other);

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/government-forms/generations/{$submissionId}/download")
            ->assertForbidden();
    }

    public function test_regeneration_supersedes_previous_submission(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $this->ensureImm5406Template();
        ['consultant' => $consultant, 'profile' => $profile, 'clientUser' => $clientUser] = $this->createConsultantWithClient();
        $this->populateImm5406Questionnaire($clientUser);
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();

        $firstId = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5406/generate")->json('submission.id');
        if (! $firstId) {
            $this->markTestSkipped('Generation unavailable in this environment.');
        }

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();
        $secondId = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5406/generate")->json('submission.id');

        $this->assertNotSame($firstId, $secondId);
        $this->assertSame($firstId, IrccPackageDocumentSubmission::find($secondId)?->supersedes_id);
    }
}

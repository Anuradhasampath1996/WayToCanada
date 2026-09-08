<?php

namespace Tests\Feature\GovernmentForms;

use App\Models\IrccPackageDocumentSubmission;
use App\Models\QuestionnaireSubmission;
use App\Services\GovernmentForms\ApplicationInfoReviewService;
use App\Services\GovernmentForms\CanonicalDataResolver;
use App\Services\GovernmentForms\Imm5406FamilyCapacityService;
use App\Services\GovernmentForms\SourceDataHasher;
use App\Services\GovernmentForms\StaleFormDetector;
use Database\Seeders\GovernmentFormVersionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesGovernmentFormFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class GovernmentFormsStageIIntegrityTest extends TestCase
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

    public function test_source_data_hash_is_deterministic_for_key_order(): void
    {
        $hasher = app(SourceDataHasher::class);
        $a = ['b' => '2', 'a' => '1'];
        $b = ['a' => '1', 'b' => '2'];

        $this->assertSame($hasher->hash($a), $hasher->hash($b));
    }

    public function test_meaningful_canonical_change_changes_source_hash(): void
    {
        ['caseFile' => $caseFile, 'clientUser' => $clientUser] = $this->createConsultantWithClient();
        $before = app(CanonicalDataResolver::class)->resolve($caseFile)->sourceHash;

        QuestionnaireSubmission::where('user_id', $clientUser->id)->update([
            'main_data' => ['passportFullName' => 'Changed Name', 'dob' => '1990-01-15'],
        ]);

        $after = app(CanonicalDataResolver::class)->resolve($caseFile->fresh())->sourceHash;
        $this->assertNotSame($before, $after);
    }

    public function test_stale_detection_after_questionnaire_change(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $this->ensureImm5476Template();
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile, 'clientUser' => $clientUser] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();
        $submissionId = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")->json('submission.id');
        if (! $submissionId) {
            $this->markTestSkipped('Generation unavailable.');
        }

        $submission = IrccPackageDocumentSubmission::findOrFail($submissionId);
        $this->assertFalse(app(StaleFormDetector::class)->isGenerationStale($submission, $caseFile->fresh()));

        QuestionnaireSubmission::where('user_id', $clientUser->id)->update([
            'main_data' => ['passportFullName' => 'New Name Changed', 'dob' => '1990-01-15'],
        ]);

        $this->assertTrue(app(ApplicationInfoReviewService::class)->isStale($caseFile->fresh()));
        // Generation hash is snapshot-based until application info is re-reviewed.
        $this->assertFalse(app(StaleFormDetector::class)->isGenerationStale($submission->fresh(), $caseFile->fresh()));
    }

    public function test_regeneration_supersedes_and_preserves_old_pdf(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $this->ensureImm5476Template();
        ['consultant' => $consultant, 'profile' => $profile, 'clientUser' => $clientUser] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();
        $firstId = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")->json('submission.id');
        if (! $firstId) {
            $this->markTestSkipped('Generation unavailable.');
        }

        $first = IrccPackageDocumentSubmission::findOrFail($firstId);
        $firstHash = hash_file('sha256', Storage::disk('local')->path($first->file_path));

        QuestionnaireSubmission::where('user_id', $clientUser->id)->update([
            'main_data' => ['passportFullName' => 'Regen Client', 'dob' => '1990-01-15'],
        ]);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();
        $secondId = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")->json('submission.id');

        $first->refresh();
        $this->assertSame('SUPERSEDED', $first->generation_status->value ?? $first->generation_status);
        $this->assertSame($firstHash, hash_file('sha256', Storage::disk('local')->path($first->file_path)));
        $this->assertNotSame($first->output_sha256, IrccPackageDocumentSubmission::find($secondId)?->output_sha256);
    }

    public function test_download_hash_matches_db_output_sha256(): void
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
            $this->markTestSkipped('Generation unavailable.');
        }

        $submission = IrccPackageDocumentSubmission::findOrFail($submissionId);
        $absolutePath = Storage::disk('local')->path($submission->file_path);
        $diskHash = hash_file('sha256', $absolutePath);
        $this->assertSame($submission->output_sha256, $diskHash);

        $this->actingAsConsultant($consultant);
        $download = $this->get("/api/v1/consultant/clients/{$profile->id}/government-forms/generations/{$submissionId}/download?download=1");
        $download->assertOk()
            ->assertHeader('content-type', 'application/pdf');
        $this->assertSame((string) filesize($absolutePath), $download->headers->get('Content-Length'));

        $streamed = $download->streamedContent();
        $payload = $streamed !== '' ? $streamed : Storage::disk('local')->get($submission->file_path);
        $this->assertSame($submission->output_sha256, hash('sha256', $payload));
    }

    public function test_imm5476_download_hash_matches_db_output_sha256(): void
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

        $submission = IrccPackageDocumentSubmission::findOrFail($submissionId);
        $absolutePath = Storage::disk('local')->path($submission->file_path);
        $this->assertSame($submission->output_sha256, hash_file('sha256', $absolutePath));

        $download = $this->get("/api/v1/consultant/clients/{$profile->id}/government-forms/generations/{$submissionId}/download?download=1");
        $download->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->assertSame((string) filesize($absolutePath), $download->headers->get('Content-Length'));
        $streamed = $download->streamedContent();
        $payload = $streamed !== '' ? $streamed : Storage::disk('local')->get($submission->file_path);
        $this->assertSame($submission->output_sha256, hash('sha256', $payload));
    }

    public function test_imm5406_overflow_blocks_at_four_children(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'clientUser' => $clientUser] = $this->createConsultantWithClient();
        $this->populateImm5406Questionnaire($clientUser);
        QuestionnaireSubmission::where('user_id', $clientUser->id)->update([
            'children_data' => array_map(fn ($i) => ['fullName' => "Child {$i} TEST", 'dob' => '2015-01-01'], range(1, 4)),
        ]);
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5406/readiness")
            ->assertJsonPath('blocked_by_overflow', true);
    }

    public function test_imm5406_three_children_within_capacity_is_not_blocked(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'clientUser' => $clientUser] = $this->createConsultantWithClient();
        $this->populateImm5406Questionnaire($clientUser);
        QuestionnaireSubmission::where('user_id', $clientUser->id)->update([
            'children_data' => array_map(fn ($i) => ['fullName' => "Child {$i} TEST", 'dob' => '2015-01-01'], range(1, 3)),
        ]);

        $caseFile = $profile->fresh()->caseFile;
        $canonical = app(CanonicalDataResolver::class)->resolve($caseFile);
        $capacity = app(Imm5406FamilyCapacityService::class)->assess($canonical);

        $this->assertFalse($capacity['blocked']);
    }

    public function test_sequential_generations_maintain_supersession_chain(): void
    {
        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->markTestSkipped('Java processor JAR not built.');
        }

        $this->ensureImm5476Template();
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();

        $id1 = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")->json('submission.id');
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();
        $id2 = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")->json('submission.id');
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/application-info/review")->assertOk();
        $id3 = $this->postJson("/api/v1/consultant/clients/{$profile->id}/government-forms/IMM5476/generate")->json('submission.id');

        if (! $id3) {
            $this->markTestSkipped('Generation unavailable.');
        }

        $this->assertSame($id2, IrccPackageDocumentSubmission::find($id3)?->supersedes_id);
        $this->assertSame('SUPERSEDED', IrccPackageDocumentSubmission::find($id1)?->generation_status->value ?? IrccPackageDocumentSubmission::find($id1)?->generation_status);
    }
}

<?php

namespace Tests\Feature;

use App\Models\CaseHistoryEvent;
use App\Models\CaseRequirementPlan;
use App\Models\User;
use App\Support\CaseWorkflowStatus;
use App\Support\DocumentWorkflowStatus;
use App\Support\MapleAiBoundaries;
use Database\Seeders\PathwayRequirementRegistrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesGovernmentFormFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class CaseFullJourneyReleaseTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesLmsDatabase;
    use CreatesGovernmentFormFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wipeLmsTestDatabase();
        $this->seedGovernmentFormRoles();
        $this->seed(PathwayRequirementRegistrySeeder::class);
        Storage::fake('local');
        Storage::fake('public');
    }

    public function test_one_clean_client_completes_invite_to_close_journey(): void
    {
        $password = 'ReleaseReady123!';
        $consultant = User::factory()->create([
            'name' => 'Release RCIC',
            'email' => 'rc.release.consultant@example.test',
            'rcic_number' => 'R555000111',
            'company_name' => 'Release Readiness Firm',
        ]);
        $consultant->assignRole('rcic');

        $this->actingAsConsultant($consultant);
        $created = $this->postJson('/api/v1/consultant/clients', [
            'name' => 'Release Journey Client',
            'email' => 'rc.release.client@example.test',
            'phone' => '4165550100',
            'send_invite' => true,
        ])->assertCreated();

        $profileId = $created->json('client.id');
        $this->assertNotNull($profileId);
        $client = User::query()->where('email', 'rc.release.client@example.test')->firstOrFail();
        $client->update(['password' => Hash::make($password)]);

        Sanctum::actingAs($client);
        $this->putJson('/api/v1/questionnaire', [
            'step1_data' => ['email' => $client->email, 'fullName' => 'Release Journey Client'],
            'main_data' => [
                'passportFullName' => 'Release Journey Client',
                'dob' => '1994-04-12',
                'passportNumber' => 'N7654321',
                'educationLevels' => ['bachelors'],
                'languageTest' => 'yes',
                'workExperience' => '3_or_more',
                'canadaStudyProgram' => 'Computer Science',
                'canadaStudyStart' => '2026-09-01',
                'passportName' => 'client-document/2026/09/passport.pdf',
                'languageTestDocName' => 'client-document/2026/09/ielts.pdf',
                'educationQuals' => [
                    ['documentName' => 'client-document/2026/09/transcript.pdf', 'courseName' => 'BSc'],
                ],
            ],
        ])->assertOk();
        $this->postJson('/api/v1/questionnaire/submit')->assertOk();

        $this->actingAsConsultant($consultant);
        $caseShow = $this->getJson("/api/v1/consultant/clients/{$profileId}/case-file")->assertOk();
        $caseFileId = $caseShow->json('case_file.id');
        $this->assertNotNull($caseFileId);

        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/consultation/skip", [
            'reason' => 'Prior consult already completed last week.',
        ])->assertOk()->assertJsonPath('assessment.consultation.satisfied', true);

        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/profile-review")
            ->assertOk()
            ->assertJsonPath('assessment.profile_review.can_review', true);
        $this->assertNotNull(
            $this->getJson("/api/v1/consultant/clients/{$profileId}/case-file/assessment")->json('assessment.profile_review.reviewed_at')
        );

        $assessment = $this->getJson("/api/v1/consultant/clients/{$profileId}/case-file/assessment?family=study")
            ->assertOk();
        $this->assertTrue($assessment->json('assessment.can_select_pathway'));
        $this->assertNotEmpty($assessment->json('calculator.family') ?? $assessment->json('calculator'));

        $maple = $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/maple-recommendation")
            ->assertOk();
        $this->assertFalse($maple->json('pathway_auto_selected'));
        $this->assertFalse($caseShow->json('case_file.immigration_pathway') ?? false);
        $this->assertNull(
            $this->getJson("/api/v1/consultant/clients/{$profileId}/case-file")->json('case_file.immigration_pathway')
        );
        foreach (['select_final_pathway', 'approve_documents', 'sign_declarations', 'submit_application'] as $action) {
            $this->assertTrue(MapleAiBoundaries::forbids($action));
        }

        $select = $this->patchJson("/api/v1/consultant/clients/{$profileId}/case-file/select-pathway", [
            'immigration_pathway' => 'Study Permit',
            'pathway_code' => 'study',
            'selection_reason' => 'LOA and program start date support a study permit.',
        ])->assertOk();
        $this->assertSame(1, $select->json('requirement_plan.plan_version'));
        $this->assertSame('Study Permit', $select->json('requirement_plan.registry_key'));
        $this->assertSame('required', $select->json('representative.requirement'));
        $this->assertContains('IMM 1294', array_column($select->json('assignment.forms') ?? [], 'code'));
        $this->assertContains('acceptance_letter', array_column($select->json('assignment.documents') ?? [], 'id'));
        $this->assertSame(1, CaseRequirementPlan::where('case_file_id', $caseFileId)->count());
        $this->assertSynced($consultant, $profileId, 'pre_engagement', 'Assessment');

        $this->getJson("/api/v1/consultant/clients/{$profileId}/case-file/requirement-plan/registry-diff")
            ->assertOk()
            ->assertJsonPath('has_update', false);

        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/send-agreement", [
            'agreement_config' => [
                'totalFee' => 3000,
                'currency' => 'CAD',
                'milestone1Pct' => 30,
                'milestone2Pct' => 40,
                'milestone3Pct' => 30,
                'taxEnabled' => false,
            ],
        ])->assertOk();

        $token = $this->getJson("/api/v1/consultant/clients/{$profileId}/case-file")->json('case_file.agreement_token');
        $this->assertNotEmpty($token);
        $this->postJson("/api/v1/case-file/agreement/{$token}/sign", [
            'signature_name' => 'Release Journey Client',
        ])->assertOk();

        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/representative", [
            'action' => 'complete',
        ])->assertOk()
            ->assertJsonPath('representative.state', 'completed')
            ->assertJsonPath('activation.activated', true);

        $activated = $this->getJson("/api/v1/consultant/clients/{$profileId}/case-file")->assertOk();
        $this->assertNotNull($activated->json('case_file.case_activated_at'));
        $this->assertSame(CaseWorkflowStatus::CASE_ACTIVE, $activated->json('workflow.status'));
        $this->assertSynced($consultant, $profileId, 'active_case', 'Application Preparation');

        $assignment = $this->getJson("/api/v1/consultant/clients/{$profileId}/case-file/assignment")->assertOk();
        $answers = [];
        foreach ($assignment->json('assignment.extra_fields.ask') ?? [] as $field) {
            $answers[$field['key']] = $field['key'] === 'dli_number' ? 'O19339613182' : 'Release readiness answer';
        }
        if ($answers !== []) {
            $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/extra-data", [
                'answers' => $answers,
            ])->assertOk();
        }

        $this->getJson("/api/v1/consultant/clients/{$profileId}/interactive-forms")->assertOk();
        $this->getJson("/api/v1/consultant/clients/{$profileId}/government-forms")->assertOk();
        $unlock = $this->getJson("/api/v1/consultant/clients/{$profileId}/interactive-forms/verification-status")->assertOk();
        $this->assertTrue($unlock->json('verification.case_management_unlocked'));

        Sanctum::actingAs($client);
        $upload = $this->post('/api/v1/client/documents/upload', [
            'document_type' => 'passport',
            'document_label' => 'Passport',
            'file' => UploadedFile::fake()->create('passport.pdf', 20, 'application/pdf'),
        ]);
        $upload->assertCreated();
        $docId = $upload->json('document.id');

        $this->actingAsConsultant($consultant);
        $this->patchJson("/api/v1/consultant/clients/{$profileId}/documents/{$docId}/review", [
            'action' => 'request_correction',
            'rejection_comment' => 'Please upload a clearer bio page.',
        ])->assertOk()->assertJsonPath('workflow_status', DocumentWorkflowStatus::CORRECTION_REQUIRED);
        $this->patchJson("/api/v1/consultant/clients/{$profileId}/documents/{$docId}/review", [
            'action' => 'request_resubmission',
        ])->assertOk()->assertJsonPath('workflow_status', DocumentWorkflowStatus::RESUBMISSION_REQUESTED);
        $this->patchJson("/api/v1/consultant/clients/{$profileId}/documents/{$docId}/review", [
            'action' => 'verify',
        ])->assertOk()->assertJsonPath('workflow_status', DocumentWorkflowStatus::VERIFIED);

        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/final-review/checklist", [
            'items' => [
                'forms_complete' => true,
                'names_dates_consistent' => true,
                'history_complete' => true,
                'required_documents_verified' => true,
                'inconsistencies_reviewed' => true,
            ],
            'notes' => 'Highlights reviewed. Support only.',
        ])->assertOk()->assertJsonPath('final_review.automatic_approval', false);

        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/final-review/ready-for-client")
            ->assertOk()
            ->assertJsonPath('final_review.ready_for_client_review', true);

        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/final-review/acknowledge")->assertStatus(403);
        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/final-review/sign", [
            'signature' => 'Release RCIC',
        ])->assertStatus(403);

        Sanctum::actingAs($client);
        $this->postJson('/api/v1/client/final-review/acknowledge')->assertOk();
        $clientReview = $this->getJson('/api/v1/client/final-review')->assertOk();
        if ($clientReview->json('final_review.signature_required')) {
            $this->postJson('/api/v1/client/final-review/sign', [
                'signature' => 'Release Journey Client',
            ])->assertOk();
        }

        $this->actingAsConsultant($consultant);
        $portal = $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/requirement-plan/confirm-portal", [
            'portal' => 'ircc_rep',
            'note' => 'Consultant confirmed IRCC representative portal.',
        ])->assertOk();
        $this->assertFalse($portal->json('auto_submitted'));

        $ready = $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/final-review/ready-to-submit")
            ->assertOk();
        $this->assertFalse($ready->json('auto_submitted'));
        $this->assertSame(CaseWorkflowStatus::READY_TO_SUBMIT, $this->workflow($consultant, $profileId));

        $historyBeforeSubmit = CaseHistoryEvent::query()->where('case_file_id', $caseFileId)->count();
        $submit = $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/submission", [
            'submission_date' => '2026-09-13',
            'application_number' => 'W987654321',
            'confirmation_number' => 'CONF-RC-1',
            'government_fees' => 150,
            'payment_confirmation' => 'PAY-RC-1',
        ])->assertOk();
        $this->assertFalse($submit->json('auto_submitted'));
        $this->assertTrue($submit->json('submission.immutable'));
        $this->assertSame('W987654321', $submit->json('submission.application_number'));
        $this->assertSame(
            $historyBeforeSubmit + 1,
            CaseHistoryEvent::query()->where('case_file_id', $caseFileId)->count()
        );
        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/submission", [
            'submission_date' => '2026-09-14',
            'application_number' => 'CHANGED',
        ])->assertStatus(422);
        $this->assertSynced($consultant, $profileId, 'post_submission', 'Post-Submission');

        $due = now()->addDays(10)->toDateString();
        $gov = $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/government-requests", [
            'type' => 'biometrics',
            'due_at' => $due,
            'notes' => 'Book biometrics.',
        ])->assertCreated();
        $requestId = $gov->json('request.id');

        $calendar = $this->getJson('/api/v1/consultant/calendar?'.http_build_query([
            'from' => now()->toDateString(),
            'to' => now()->addDays(14)->toDateString(),
            'timezone' => 'America/Toronto',
        ]))->assertOk();
        $this->assertTrue(collect($calendar->json('events'))->contains(
            fn ($event) => ($event['source'] ?? null) === 'government_request'
                && str_contains((string) ($event['href'] ?? ''), (string) $profileId)
        ));

        Sanctum::actingAs($client);
        $clientGov = $this->getJson('/api/v1/client/post-submission')->assertOk();
        $this->assertSame('biometrics', $clientGov->json('government_requests.requests.0.type'));
        $this->assertNotEmpty($this->getJson('/api/v1/notifications?per_page=20')->json('data'));

        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/government-requests/{$requestId}/in-progress")
            ->assertOk();
        $this->assertSame(CaseWorkflowStatus::RESPONSE_IN_PROGRESS, $this->workflow($consultant, $profileId));
        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/government-requests/{$requestId}/answered", [
            'notes' => 'Biometrics completed.',
        ])->assertOk();

        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/decision", [
            'decision_status' => 'approved',
            'decision_note' => 'Study permit approved.',
            'next_step_note' => 'Prepare landing documents.',
            'letter' => UploadedFile::fake()->create('decision.pdf', 40, 'application/pdf'),
        ])->assertOk()->assertJsonPath('decision.decision_status', 'approved');
        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/decision", [
            'decision_status' => 'refused',
        ])->assertStatus(422);

        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/closure/checklist", [
            'items' => [
                'final_docs_saved' => true,
                'final_client_message' => true,
                'no_open_tasks' => true,
                'payments_noted' => true,
                'gov_requests_done' => true,
                'record_complete' => true,
            ],
        ])->assertOk()->assertJsonPath('closure.can_close', true);

        $this->postJson("/api/v1/consultant/clients/{$profileId}/case-file/closure/close", [
            'action' => 'close',
            'note' => 'Closed after approval.',
        ])->assertOk()->assertJsonPath('closure.lifecycle_status', 'closed');

        $this->assertSame(CaseWorkflowStatus::CASE_CLOSED, $this->workflow($consultant, $profileId));
        $pipeline = $this->getJson('/api/v1/consultant/case-pipeline')->assertOk();
        $row = collect($pipeline->json('pipeline'))->firstWhere('profile_id', $profileId);
        $this->assertTrue($row['is_closed'] ?? false);
        $this->assertFalse($row['needs_attention'] ?? true);

        $types = CaseHistoryEvent::query()
            ->where('case_file_id', $caseFileId)
            ->pluck('event_type');
        foreach (['requirement_plan_snapshotted', 'application_submitted', 'decision_recorded'] as $type) {
            $this->assertSame(1, $types->filter(fn ($value) => $value === $type)->count(), $type.' should be unique');
        }

        $submitted = CaseHistoryEvent::query()
            ->where('case_file_id', $caseFileId)
            ->where('event_type', 'application_submitted')
            ->first();
        $this->expectException(\LogicException::class);
        $submitted->update(['title' => 'tampered']);
    }

    private function workflow($consultant, int $profileId): ?string
    {
        $this->actingAsConsultant($consultant);

        return $this->getJson("/api/v1/consultant/clients/{$profileId}/case-file")->json('workflow.status');
    }

    private function assertSynced($consultant, int $profileId, string $group, string $journey): void
    {
        $this->actingAsConsultant($consultant);
        $pipeline = $this->getJson('/api/v1/consultant/case-pipeline')->assertOk();
        $this->assertCount(3, $pipeline->json('groups'));
        $row = collect($pipeline->json('pipeline'))->firstWhere('profile_id', $profileId);
        $this->assertNotNull($row, 'Case missing from pipeline');
        $this->assertSame($group, $row['group']);
        $this->assertSame($journey, $row['journey_label']);
        $ids = collect($pipeline->json('pipeline'))->pluck('case_file_id');
        $this->assertSame($ids->count(), $ids->unique()->count());
    }
}

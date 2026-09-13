<?php

namespace Tests\Feature;

use App\Models\CaseHistoryEvent;
use App\Support\CaseWorkflowStatus;
use Database\Seeders\PathwayRequirementRegistrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesGovernmentFormFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class CaseFinalReviewAndSubmissionTest extends TestCase
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
    }

    public function test_final_review_highlights_never_auto_approve_and_client_must_acknowledge(): void
    {
        ['consultant' => $consultant, 'clientUser' => $client, 'profile' => $profile, 'caseFile' => $caseFile]
            = $this->createConsultantWithClient();
        $this->prepareActivatedStudyCase($consultant, $profile, $caseFile);

        $this->actingAsConsultant($consultant);
        $show = $this->getJson("/api/v1/consultant/clients/{$profile->id}/case-file/final-review")
            ->assertOk();
        $this->assertFalse($show->json('final_review.automatic_approval'));
        $this->assertTrue($show->json('final_review.highlights_are_support_only'));
        $this->assertFalse($show->json('final_review.checklist_complete'));
        $this->assertFalse($show->json('final_review.consultant_can_acknowledge'));
        $this->assertFalse($show->json('final_review.consultant_can_sign'));
        $this->assertContains('sign_declarations', $show->json('final_review.maple_forbidden'));
        $this->assertContains('submit_application', $show->json('final_review.maple_forbidden'));

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/final-review/ready-for-client")
            ->assertStatus(422);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/final-review/checklist", [
            'items' => [
                'forms_complete' => true,
                'names_dates_consistent' => true,
                'history_complete' => true,
                'required_documents_verified' => true,
                'inconsistencies_reviewed' => true,
            ],
            'notes' => 'Reviewed highlights. No automatic approval.',
        ])->assertOk()
            ->assertJsonPath('final_review.checklist_complete', true)
            ->assertJsonPath('final_review.automatic_approval', false);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/final-review/ready-for-client")
            ->assertOk()
            ->assertJsonPath('final_review.ready_for_client_review', true);

        $this->assertSame(CaseWorkflowStatus::CLIENT_REVIEW, $caseFile->fresh()->workflow_status);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/final-review/acknowledge")
            ->assertStatus(403);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/final-review/sign", [
            'signature' => 'Jane Consultant',
        ])->assertStatus(403);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/final-review/ready-to-submit")
            ->assertStatus(422);

        Sanctum::actingAs($client);
        $clientShow = $this->getJson('/api/v1/client/final-review')->assertOk();
        $this->assertTrue($clientShow->json('final_review.read_only'));
        $this->assertNull($clientShow->json('final_review.checklist'));
        $this->assertTrue($clientShow->json('final_review.signature_required'));

        $this->postJson('/api/v1/client/final-review/acknowledge')->assertOk()
            ->assertJsonPath('final_review.acknowledged', true);
        $this->assertNotNull($caseFile->fresh()->client_acknowledged_at);

        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/requirement-plan/confirm-portal", [
            'portal' => 'ircc_rep',
            'note' => 'Consultant confirmed IRCC representative portal.',
        ])->assertOk()->assertJsonPath('auto_submitted', false);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/final-review/ready-to-submit")
            ->assertStatus(422);

        Sanctum::actingAs($client);
        $this->postJson('/api/v1/client/final-review/sign', [
            'signature' => 'Synthetic Applicant',
        ])->assertOk()->assertJsonPath('final_review.signed', true);

        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/final-review/ready-to-submit")
            ->assertOk()
            ->assertJsonPath('final_review.ready_to_submit', true)
            ->assertJsonPath('auto_submitted', false);

        $this->assertSame('READY_FOR_SUBMISSION', $caseFile->fresh()->status);
        $this->assertSame(CaseWorkflowStatus::READY_TO_SUBMIT, $caseFile->fresh()->workflow_status);

        $historyCount = CaseHistoryEvent::query()->where('case_file_id', $caseFile->id)->count();

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/submission", [
            'submission_date' => '2026-09-13',
            'application_number' => 'W123456789',
            'confirmation_number' => 'CONF-001',
            'government_fees' => 150,
            'payment_confirmation' => 'PAY-99',
        ])->assertOk()
            ->assertJsonPath('auto_submitted', false)
            ->assertJsonPath('submission.submitted', true)
            ->assertJsonPath('submission.application_number', 'W123456789')
            ->assertJsonPath('submission.immutable', true);

        $fresh = $caseFile->fresh();
        $this->assertSame('APPLICATION_SUBMITTED', $fresh->status);
        $this->assertSame(CaseWorkflowStatus::SUBMITTED, $fresh->workflow_status);
        $this->assertNotNull($fresh->submitted_documents_snapshot);

        $event = CaseHistoryEvent::query()
            ->where('case_file_id', $caseFile->id)
            ->where('event_type', 'application_submitted')
            ->first();
        $this->assertNotNull($event);
        $this->assertFalse($event->payload['auto_submitted'] ?? true);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/submission", [
            'submission_date' => '2026-09-14',
            'application_number' => 'CHANGED',
        ])->assertStatus(422);

        $this->assertSame('W123456789', $caseFile->fresh()->application_number);
        $this->assertSame($historyCount + 1, CaseHistoryEvent::query()->where('case_file_id', $caseFile->id)->count());

        $this->expectException(\LogicException::class);
        $event->update(['title' => 'tampered']);
    }

    public function test_signature_skipped_when_snapshot_does_not_require_it(): void
    {
        ['consultant' => $consultant, 'clientUser' => $client, 'profile' => $profile, 'caseFile' => $caseFile]
            = $this->createConsultantWithClient();
        $this->prepareActivatedStudyCase($consultant, $profile, $caseFile);

        $plan = $caseFile->fresh()->currentRequirementPlan;
        $snapshot = $plan->snapshot;
        $snapshot['client_signature_required'] = false;
        $plan->update(['snapshot' => $snapshot]);

        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/final-review/checklist", [
            'items' => [
                'forms_complete' => true,
                'names_dates_consistent' => true,
                'history_complete' => true,
                'required_documents_verified' => true,
                'inconsistencies_reviewed' => true,
            ],
        ])->assertOk();
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/final-review/ready-for-client")->assertOk();
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/requirement-plan/confirm-portal", [
            'portal' => 'ircc_rep',
        ])->assertOk();

        Sanctum::actingAs($client);
        $this->postJson('/api/v1/client/final-review/sign', ['signature' => 'Should fail'])
            ->assertStatus(422);
        $this->postJson('/api/v1/client/final-review/acknowledge')->assertOk();

        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/final-review/ready-to-submit")
            ->assertOk()
            ->assertJsonPath('final_review.signature_required', false)
            ->assertJsonPath('final_review.ready_to_submit', true);
    }

    private function prepareActivatedStudyCase($consultant, $profile, $caseFile): void
    {
        $this->completeSelectPathwayGates($consultant, $profile);
        $this->actingAsConsultant($consultant);
        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Study Permit',
            'pathway_code' => 'study',
            'selection_reason' => 'Study permit is the intended next step.',
        ])->assertOk();

        $caseFile->update([
            'agreement_signed_at' => now(),
            'status' => 'AGREEMENT_SIGNED',
        ]);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/representative", [
            'action' => 'complete',
        ])->assertOk();
    }
}

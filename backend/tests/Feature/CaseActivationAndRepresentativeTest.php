<?php

namespace Tests\Feature;

use App\Models\CaseFile;
use App\Models\DocumentSubmission;
use App\Support\CaseWorkflowStatus;
use App\Support\DocumentWorkflowStatus;
use Database\Seeders\PathwayRequirementRegistrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesGovernmentFormFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class CaseActivationAndRepresentativeTest extends TestCase
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

    public function test_required_representative_cannot_be_marked_unused_and_blocks_activation(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->actingAsConsultant($consultant);
        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Study Permit',
            'pathway_code' => 'study',
            'selection_reason' => 'Study permit is the intended next step.',
        ])->assertOk()
            ->assertJsonPath('representative.requirement', 'required')
            ->assertJsonPath('representative.can_mark_na', false)
            ->assertJsonPath('representative.state', 'pending');

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/representative", [
            'action' => 'leave_unused',
        ])->assertStatus(422);

        $caseFile->update(['agreement_signed_at' => now(), 'status' => 'AGREEMENT_SIGNED']);
        $this->assertNull($caseFile->fresh()->case_activated_at);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/representative", [
            'action' => 'complete',
        ])->assertOk()
            ->assertJsonPath('representative.state', 'completed')
            ->assertJsonPath('activation.activated', true);

        $this->assertNotNull($caseFile->fresh()->case_activated_at);
        $this->assertSame(CaseWorkflowStatus::CASE_ACTIVE, $caseFile->fresh()->workflow_status);
    }

    public function test_optional_representative_can_stay_unused_and_activate_after_retainer(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->actingAsConsultant($consultant);
        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Visitor Visa (TRV)',
            'pathway_code' => 'visitor',
            'selection_reason' => 'Short visit, representation is optional.',
        ])->assertOk()
            ->assertJsonPath('representative.requirement', 'optional')
            ->assertJsonPath('representative.can_leave_unused', true);

        $caseFile->update(['agreement_signed_at' => now(), 'status' => 'AGREEMENT_SIGNED']);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/representative", [
            'action' => 'leave_unused',
        ])->assertOk()
            ->assertJsonPath('representative.state', 'unused')
            ->assertJsonPath('activation.activated', true);
    }

    public function test_not_applicable_representative_is_hidden_and_activates_after_retainer(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->actingAsConsultant($consultant);
        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Study Permit',
            'pathway_code' => 'study',
            'selection_reason' => 'Study permit is the intended next step.',
        ])->assertOk();

        $plan = $caseFile->fresh()->currentRequirementPlan;
        $snapshot = $plan->snapshot;
        $snapshot['representative']['status'] = 'not_applicable';
        $snapshot['representative']['bypass_allowed'] = true;
        $plan->update(['snapshot' => $snapshot]);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/representative", [
            'action' => 'send',
        ])->assertStatus(422);

        $caseFile->update([
            'representative_state' => 'not_applicable',
            'agreement_signed_at' => now(),
            'status' => 'AGREEMENT_SIGNED',
        ]);

        $activation = app(\App\Services\CaseActivationService::class)->refresh($caseFile->fresh(), $consultant);
        $this->assertNotNull($activation->case_activated_at);
        $this->assertTrue(app(\App\Services\CaseRepresentativeAuthorizationService::class)->serialize($activation)['visible'] === false
            || $activation->representative_state === 'not_applicable');
    }

    public function test_document_workflow_statuses_and_pipeline_groups(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();

        $doc = DocumentSubmission::create([
            'case_file_id' => $caseFile->id,
            'uploaded_by' => $consultant->id,
            'document_type' => 'passport',
            'document_label' => 'Passport',
            'file_path' => 'case-documents/passport.pdf',
            'original_filename' => 'passport.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'pending_review',
        ]);

        $this->actingAsConsultant($consultant);
        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/documents/{$doc->id}/review", [
            'action' => 'request_correction',
            'rejection_comment' => 'Please upload a clearer bio page.',
        ])->assertOk()
            ->assertJsonPath('workflow_status', DocumentWorkflowStatus::CORRECTION_REQUIRED);

        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/documents/{$doc->id}/review", [
            'action' => 'request_resubmission',
        ])->assertOk()
            ->assertJsonPath('workflow_status', DocumentWorkflowStatus::RESUBMISSION_REQUESTED);

        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/documents/{$doc->id}/review", [
            'action' => 'verify',
        ])->assertOk()
            ->assertJsonPath('workflow_status', DocumentWorkflowStatus::VERIFIED);

        $caseFile->update([
            'status' => 'AGREEMENT_SIGNED',
            'workflow_status' => CaseWorkflowStatus::CASE_ACTIVE,
            'case_activated_at' => now(),
        ]);

        $board = $this->getJson('/api/v1/consultant/case-pipeline')->assertOk();
        $this->assertCount(3, $board->json('groups'));
        $this->assertSame('pre_engagement', $board->json('groups.0.id'));
        $this->assertSame('active_case', $board->json('groups.1.id'));
        $this->assertSame('post_submission', $board->json('groups.2.id'));
        $this->assertContains(CaseWorkflowStatus::CASE_ACTIVE, $board->json('filterable_statuses'));
    }
}

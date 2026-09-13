<?php

namespace Tests\Feature;

use App\Models\CaseHistoryEvent;
use App\Models\CaseRequirementPlan;
use App\Models\PathwayRequirementDefinition;
use App\Support\CaseWorkflowStatus;
use App\Support\PathwayRequirementCatalog;
use Database\Seeders\PathwayRequirementRegistrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesGovernmentFormFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class CaseRequirementPlanTest extends TestCase
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

    public function test_selecting_a_pathway_writes_a_versioned_requirement_plan(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Express Entry – Canadian Experience Class',
            'pathway_code' => 'ee.cec',
            'selection_reason' => 'CEC fits Canadian work and study history.',
        ])->assertOk()
            ->assertJsonPath('requirement_plan.plan_version', 1)
            ->assertJsonPath('requirement_plan.registry_key', 'Express Entry')
            ->assertJsonPath('requirement_plan.snapshot.representative.status', 'required')
            ->assertJsonPath('requirement_plan.snapshot.representative.bypass_allowed', false)
            ->assertJsonPath('requirement_plan.snapshot.portals.confirmed', null)
            ->assertJsonPath('workflow.status', CaseWorkflowStatus::PATHWAY_SELECTED);

        $caseFile->refresh();
        $this->assertNotNull($caseFile->current_requirement_plan_id);
        $this->assertSame(1, CaseRequirementPlan::where('case_file_id', $caseFile->id)->count());
        $this->assertDatabaseHas('case_history_events', [
            'case_file_id' => $caseFile->id,
            'event_type' => 'requirement_plan_snapshotted',
        ]);
    }

    public function test_changing_pathway_keeps_the_old_plan_and_records_history(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Express Entry – Canadian Experience Class',
            'pathway_code' => 'ee.cec',
            'selection_reason' => 'CEC fits Canadian work and study history.',
        ])->assertOk();

        $firstPlanId = $caseFile->fresh()->current_requirement_plan_id;

        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Study Permit',
            'pathway_code' => 'study',
            'change_note' => 'Client will study first.',
            'selection_reason' => 'Client will study first.',
        ])->assertOk()
            ->assertJsonPath('requirement_plan.plan_version', 2)
            ->assertJsonPath('requirement_plan.registry_key', 'Study Permit')
            ->assertJsonPath('requirement_plan.previous_plan_id', $firstPlanId);

        $this->assertSame(2, CaseRequirementPlan::where('case_file_id', $caseFile->id)->count());
        $this->assertSame('superseded', CaseRequirementPlan::find($firstPlanId)?->status);
        $this->assertSame(2, $caseFile->fresh()->currentRequirementPlan?->plan_version);

        $change = CaseHistoryEvent::query()
            ->where('case_file_id', $caseFile->id)
            ->where('event_type', 'pathway_changed')
            ->first();
        $this->assertNotNull($change);
        $this->assertSame(1, $change->payload['old_plan_version']);
        $this->assertSame(2, $change->payload['new_plan_version']);
        $this->assertSame('Client will study first.', $change->description);
        $this->assertNotEmpty($change->payload['diff']['added_forms'] ?? []);
    }

    public function test_clearing_pathway_does_not_delete_previous_plans(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Study Permit',
            'pathway_code' => 'study',
            'selection_reason' => 'Study permit is the intended next step.',
        ])->assertOk();

        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => null,
            'pathway_code' => null,
        ])->assertOk();

        $this->assertSame(1, CaseRequirementPlan::where('case_file_id', $caseFile->id)->count());
        $this->assertNull($caseFile->fresh()->current_requirement_plan_id);
        $this->assertSame('superseded', CaseRequirementPlan::where('case_file_id', $caseFile->id)->first()?->status);
        $this->assertDatabaseHas('case_history_events', [
            'case_file_id' => $caseFile->id,
            'event_type' => 'pathway_cleared',
        ]);
    }

    public function test_registry_update_is_diffed_and_applied_only_on_confirm(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Study Permit',
            'pathway_code' => 'study',
            'selection_reason' => 'Study permit is the intended next step.',
        ])->assertOk();

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/case-file/requirement-plan/registry-diff")
            ->assertOk()
            ->assertJsonPath('has_update', false);

        $v1 = PathwayRequirementDefinition::query()
            ->where('registry_key', 'Study Permit')
            ->where('version', PathwayRequirementCatalog::VERSION)
            ->first();
        $this->assertNotNull($v1);

        $definition = $v1->definition;
        $definition['official_form_codes'][] = 'IMM 5708';
        $definition['documents'][] = [
            'id' => 'pal_letter',
            'label' => 'Provincial attestation letter',
            'category' => 'study',
            'required_if' => [],
            'reuse_from' => [],
        ];

        PathwayRequirementDefinition::create([
            'registry_key' => 'Study Permit',
            'family' => 'Study Permit',
            'version' => PathwayRequirementCatalog::VERSION + 1,
            'effective_from' => now()->subMinute(),
            'effective_to' => null,
            'source_name' => PathwayRequirementCatalog::SOURCE_NAME,
            'source_reference' => 'Test registry v2',
            'last_verified_at' => now(),
            'definition' => $definition,
            'is_published' => true,
        ]);

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/case-file/requirement-plan/registry-diff")
            ->assertOk()
            ->assertJsonPath('has_update', true)
            ->assertJsonPath('latest_registry_version', PathwayRequirementCatalog::VERSION + 1);

        $this->assertSame(1, $caseFile->fresh()->currentRequirementPlan?->registry_version);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/requirement-plan/apply-registry-update", [
            'note' => 'IRCC added PAL for this stream.',
        ])->assertOk()
            ->assertJsonPath('requirement_plan.plan_version', 2)
            ->assertJsonPath('requirement_plan.registry_version', PathwayRequirementCatalog::VERSION + 1);

        $this->assertSame(2, CaseRequirementPlan::where('case_file_id', $caseFile->id)->count());
        $this->assertSame(1, CaseRequirementPlan::where('case_file_id', $caseFile->id)->where('status', 'superseded')->count());
    }

    public function test_consultant_must_confirm_portal_and_nothing_is_auto_submitted(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Study Permit',
            'pathway_code' => 'study',
            'selection_reason' => 'Study permit is the intended next step.',
        ])->assertOk();

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/requirement-plan/confirm-portal", [
            'portal' => 'ircc_rep',
        ])->assertOk()
            ->assertJsonPath('auto_submitted', false)
            ->assertJsonPath('confirmed_submission_portal', 'ircc_rep');

        $this->assertSame('ircc_rep', $caseFile->fresh()->confirmed_submission_portal);
        $this->assertSame('ircc_rep', $caseFile->fresh()->currentRequirementPlan?->snapshot['portals']['confirmed']);
        $this->assertDatabaseHas('case_history_events', [
            'case_file_id' => $caseFile->id,
            'event_type' => 'submission_portal_confirmed',
        ]);
    }

    public function test_legacy_cases_without_a_plan_still_resolve_workflow_group(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();
        $caseFile->update(['status' => 'AGREEMENT_SIGNED', 'workflow_status' => null]);
        $this->actingAsConsultant($consultant);

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/case-file")
            ->assertOk()
            ->assertJsonPath('requirement_plan', null)
            ->assertJsonPath('workflow.status', CaseWorkflowStatus::CASE_ACTIVE)
            ->assertJsonPath('workflow.group', CaseWorkflowStatus::GROUP_ACTIVE_CASE)
            ->assertJsonPath('case_file.status', 'AGREEMENT_SIGNED');
    }
}

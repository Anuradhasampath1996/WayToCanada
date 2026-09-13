<?php

namespace Tests\Feature;

use App\Models\CaseHistoryEvent;
use App\Models\QuestionnaireSubmission;
use Database\Seeders\PathwayRequirementRegistrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesGovernmentFormFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class CaseClientAssignmentTest extends TestCase
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

    public function test_select_pathway_asks_only_missing_fields_and_reuses_intake(): void
    {
        ['consultant' => $consultant, 'clientUser' => $client, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->seedStudyIntake($profile->user_id);
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->actingAsConsultant($consultant);
        $res = $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
                'immigration_pathway' => 'Study Permit',
                'pathway_code' => 'study',
                'selection_reason' => 'Study permit matches the letter of acceptance plan.',
            ])
            ->assertOk();

        $assignment = $res->json('assignment');
        $this->assertSame('Study Permit', $assignment['registry_key']);

        $askKeys = array_column($assignment['extra_fields']['ask'], 'key');
        $reusedKeys = array_column($assignment['extra_fields']['reused'], 'key');
        $this->assertContains('dli_number', $askKeys);
        $this->assertContains('funds_source', $askKeys);
        $this->assertContains('program_name', $reusedKeys);
        $this->assertContains('program_start_date', $reusedKeys);
        $this->assertNotContains('program_name', $askKeys);

        $docIds = array_column($assignment['documents'], 'id');
        $this->assertContains('passport', $docIds);
        $this->assertContains('acceptance_letter', $docIds);
        $this->assertNotContains('eca', $docIds);
        $this->assertNotContains('express_entry_profile', $docIds);

        $passport = collect($assignment['documents'])->firstWhere('id', 'passport');
        $this->assertSame('intake', $passport['reuse_candidate']['source'] ?? null);
        $this->assertSame('passportName', $passport['reuse_candidate']['field_key'] ?? null);

        $formCodes = array_column($assignment['forms'], 'code');
        $this->assertContains('IMM 1294', $formCodes);
        $this->assertContains('IMM5476', $formCodes);
        $this->assertNotContains('IMM 0008', $formCodes);

        Sanctum::actingAs($client);
        $clientAssignment = $this->getJson('/api/v1/client/case-assignment')
            ->assertOk()
            ->json('assignment');
        $clientAsk = array_column($clientAssignment['extra_fields']['ask'] ?? [], 'key');
        $this->assertContains('dli_number', $clientAsk);
        $this->assertNotContains('express_entry_profile_number', $clientAsk);
    }

    public function test_express_entry_uses_crs_family_docs_and_conditional_items(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        QuestionnaireSubmission::where('user_id', $profile->user_id)->update([
            'step1_data' => ['married' => 'yes'],
            'spouse_data' => ['fullName' => 'Spouse Example'],
            'children_data' => [['fullName' => 'Child Example']],
            'main_data' => array_merge(
                QuestionnaireSubmission::where('user_id', $profile->user_id)->value('main_data') ?? [],
                [
                    'intendedNocCode' => '21231',
                    'countryOfResidence' => 'Canada',
                    'canadianWork' => 'yes',
                    'passportName' => 'client-document/2026/09/passport.pdf',
                ],
            ),
        ]);
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->actingAsConsultant($consultant);
        $assignment = $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
                'immigration_pathway' => 'Express Entry – Canadian Experience Class',
                'pathway_code' => 'ee.cec',
                'selection_reason' => 'CEC is the best fit for Canadian work history.',
            ])
            ->assertOk()
            ->json('assignment');

        $reusedKeys = array_column($assignment['extra_fields']['reused'], 'key');
        $this->assertContains('intended_noc_code', $reusedKeys);

        $docs = collect($assignment['documents']);
        $this->assertNotNull($docs->firstWhere('id', 'marriage_cert'));
        $this->assertNotNull($docs->firstWhere('id', 'birth_certs'));
        $this->assertNull($docs->firstWhere('id', 'proof_funds'), 'CEC should not require proof of funds as primary.');
        $this->assertNull($docs->firstWhere('id', 'acceptance_letter'));

        $formCodes = array_column($assignment['forms'], 'code');
        $this->assertContains('IMM 0008', $formCodes);
        $this->assertContains('IMM5476', $formCodes);
        $this->assertNotContains('IMM 1294', $formCodes);
    }

    public function test_client_saves_missing_fields_without_overwriting_reused_values(): void
    {
        ['consultant' => $consultant, 'clientUser' => $client, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->seedStudyIntake($profile->user_id);
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->actingAsConsultant($consultant);
        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Study Permit',
            'pathway_code' => 'study',
            'selection_reason' => 'Study permit is the intended next step.',
        ])->assertOk();

        Sanctum::actingAs($client);
        $this->postJson('/api/v1/client/case-assignment/extra-data', [
            'answers' => [
                'dli_number' => 'O19332798322',
                'program_name' => 'SHOULD NOT OVERWRITE',
            ],
        ])->assertOk();

        $assignment = $this->getJson('/api/v1/client/case-assignment')
            ->assertOk()
            ->json('assignment');

        $askKeys = array_column($assignment['extra_fields']['ask'], 'key');
        $this->assertNotContains('dli_number', $askKeys);

        $reused = collect($assignment['extra_fields']['reused'])->firstWhere('key', 'program_name');
        $this->assertSame('Computer Science', $reused['value'] ?? null);

        $this->assertDatabaseHas('case_history_events', [
            'event_type' => 'extra_data_saved',
        ]);
    }

    public function test_pathway_change_keeps_history_and_does_not_delete_prior_answers(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->seedStudyIntake($profile->user_id);
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->actingAsConsultant($consultant);
        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Study Permit',
            'pathway_code' => 'study',
            'selection_reason' => 'Study permit is the intended next step.',
        ])->assertOk();

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/extra-data", [
            'answers' => ['dli_number' => 'O19332798322'],
        ])->assertOk();

        $change = $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
                'immigration_pathway' => 'Work Permit',
                'pathway_code' => 'work',
                'selection_reason' => 'Employer offer arrived; switching to work permit.',
                'change_note' => 'Employer offer arrived; switching to work permit.',
            ])
            ->assertOk();

        $this->assertSame(2, $change->json('requirement_plan.plan_version'));
        $assignment = $change->json('assignment');
        $askKeys = array_column($assignment['extra_fields']['ask'], 'key');
        $this->assertContains('employer_name', $askKeys);
        $this->assertNotContains('dli_number', $askKeys);

        $obsolete = $change->json('requirement_plan.snapshot.obsolete_items');
        $obsoleteKeys = array_column($obsolete ?? [], 'key');
        $this->assertContains('dli_number', $obsoleteKeys);

        $this->assertSame(2, \App\Models\CaseRequirementPlan::where('case_file_id', $profile->fresh()->active_case_file_id)->count());
        $this->assertNotNull(CaseHistoryEvent::where('event_type', 'pathway_changed')->first());
    }

    public function test_work_and_family_do_not_use_crs_as_primary_assignment(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->actingAsConsultant($consultant);
        $work = $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
                'immigration_pathway' => 'Work Permit',
                'pathway_code' => 'work',
                'selection_reason' => 'Work permit matches the job offer.',
            ])
            ->assertOk()
            ->json('assignment');

        $this->assertContains('employer_name', array_column($work['extra_fields']['ask'], 'key'));
        $this->assertContains('IMM 1295', array_column($work['forms'], 'code'));
        $this->assertNotContains('IMM 0008', array_column($work['forms'], 'code'));
        $this->assertContains('lmia_job_offer', array_column($work['documents'], 'id'));

        $family = $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
                'immigration_pathway' => 'Family Sponsorship',
                'pathway_code' => 'family',
                'selection_reason' => 'Family sponsorship is the intended stream.',
                'change_note' => 'Family sponsorship is the intended stream.',
            ])
            ->assertOk()
            ->json('assignment');

        $this->assertContains('sponsor_uci', array_column($family['extra_fields']['ask'], 'key'));
        $this->assertContains('IMM 1344', array_column($family['forms'], 'code'));
        $this->assertNotContains('IMM 1295', array_column($family['forms'], 'code'));
    }

    private function seedStudyIntake(int $userId): void
    {
        $submission = QuestionnaireSubmission::where('user_id', $userId)->first();
        $main = is_array($submission?->main_data) ? $submission->main_data : [];
        QuestionnaireSubmission::where('user_id', $userId)->update([
            'main_data' => array_merge($main, [
                'canadaStudyProgram' => 'Computer Science',
                'canadaStudyStart' => '2026-09-01',
                'passportName' => 'client-document/2026/09/passport.pdf',
                'languageTestDocName' => 'client-document/2026/09/ielts.pdf',
                'educationQuals' => [
                    ['documentName' => 'client-document/2026/09/transcript.pdf', 'courseName' => 'BSc'],
                ],
            ]),
        ]);
    }
}

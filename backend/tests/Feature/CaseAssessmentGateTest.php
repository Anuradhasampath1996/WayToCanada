<?php

namespace Tests\Feature;

use App\Models\QuestionnaireSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesGovernmentFormFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class CaseAssessmentGateTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesLmsDatabase;
    use CreatesGovernmentFormFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wipeLmsTestDatabase();
        $this->seedGovernmentFormRoles();
    }

    public function test_select_pathway_is_blocked_until_consultation_and_profile_review(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Study Permit',
            'pathway_code' => 'study',
            'selection_reason' => 'Study is the intended route.',
        ])->assertStatus(422)
            ->assertJsonPath('assessment.can_select_pathway', false);
    }

    public function test_profile_review_requires_core_identity_fields(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/profile-review")
            ->assertStatus(422);
    }

    public function test_consultation_skip_requires_a_recorded_reason(): void
    {
        ['consultant' => $consultant, 'profile' => $profile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/consultation/skip", [
            'reason' => 'short',
        ])->assertStatus(422);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/consultation/skip", [
            'reason' => 'Client already interviewed last week.',
        ])->assertOk()
            ->assertJsonPath('assessment.consultation.satisfied', true);
    }

    public function test_gates_then_reason_allow_select_and_maple_does_not_assign_pathway(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();
        $this->completeSelectPathwayGates($consultant, $profile);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/maple-recommendation")
            ->assertOk()
            ->assertJsonPath('pathway_auto_selected', false);

        $this->assertNull($caseFile->fresh()->immigration_pathway);
        $this->assertNotNull($caseFile->fresh()->maple_recommendation);
        $this->assertFalse($caseFile->fresh()->maple_recommendation['auto_selected'] ?? true);

        $this->patchJson("/api/v1/consultant/clients/{$profile->id}/case-file/select-pathway", [
            'immigration_pathway' => 'Study Permit',
            'pathway_code' => 'study',
            'selection_reason' => 'LOA and funds support a study permit.',
            'alternatives' => ['PGWP later', 'CEC after work'],
            'risks' => ['Must maintain full-time study'],
        ])->assertOk();

        $caseFile->refresh();
        $this->assertSame('Study Permit', $caseFile->immigration_pathway);
        $this->assertSame('LOA and funds support a study permit.', $caseFile->pathway_selection_reason);
        $this->assertSame(['PGWP later', 'CEC after work'], $caseFile->pathway_alternatives);
    }

    public function test_questionnaire_is_not_required_before_consultation(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'clientUser' => $client] = $this->createConsultantWithClient();
        QuestionnaireSubmission::where('user_id', $client->id)->delete();
        $this->actingAsConsultant($consultant);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/consultation/complete", [
            'notes' => 'Consult first; client will finish the profile after.',
        ])->assertOk()
            ->assertJsonPath('assessment.consultation.satisfied', true)
            ->assertJsonPath('assessment.can_open_assessment', true);
    }
}

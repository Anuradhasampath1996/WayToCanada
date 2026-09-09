<?php

namespace Tests\Unit;

use App\Services\WorkspaceMapleAnswerAccuracyService;
use Tests\TestCase;

class WorkspaceMapleAnswerAccuracyServiceTest extends TestCase
{
    public function test_scores_higher_when_case_data_is_complete(): void
    {
        $svc = new WorkspaceMapleAnswerAccuracyService();

        $rich = $svc->assess([
            'case_facts' => [
                'main_applicant' => ['display_name' => 'Alex Client'],
            ],
            'case_file' => [
                'status' => 'CASE_HUB',
                'immigration_pathway' => 'Express Entry',
            ],
            'case_detail' => [
                'crs_estimate' => ['crs_total' => 470],
            ],
            'next_action' => ['title' => 'Complete forms'],
            'questionnaire' => ['has_submission' => true],
            'questionnaire_gaps' => [],
            'uploaded_documents' => [],
        ], 'Tell me about this client', 'Here is the case snapshot for Alex Client.', true);

        $this->assertSame('high', $rich['level']);
        $this->assertGreaterThanOrEqual(80, $rich['score']);
    }

    public function test_scores_lower_when_case_data_is_thin(): void
    {
        $svc = new WorkspaceMapleAnswerAccuracyService();

        $thin = $svc->assess([
            'case_facts' => [],
            'case_file' => [],
            'questionnaire' => ['has_submission' => false],
            'questionnaire_gaps' => [
                ['label' => 'Education level'],
                ['label' => 'Language scores'],
                ['label' => 'Work history'],
                ['label' => 'Passport'],
            ],
        ], 'What should I file?', 'I do not have enough on file to confirm.', false);

        $this->assertContains($thin['level'], ['low', 'medium']);
        $this->assertLessThan(80, $thin['score']);
    }
}

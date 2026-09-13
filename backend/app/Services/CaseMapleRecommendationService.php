<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\User;
use App\Support\CaseWorkflowStatus;
use App\Support\MapleAiBoundaries;

class CaseMapleRecommendationService
{
    public function __construct(
        private WorkspaceMaplePathwayAdvisorService $advisor,
        private PathwayCatalogService $catalog,
        private WorkspaceCaseDetailService $caseDetail,
        private CaseHistoryRecorder $history,
        private CaseAssessmentGateService $gates,
    ) {}

    /**
     * Decision support only. Never writes immigration_pathway.
     *
     * @return array<string, mixed>
     */
    public function generate(CaseFile $caseFile, User $actor): array
    {
        $caseFile->loadMissing('clientProfile.user');
        $submission = $this->gates->submissionFor($caseFile);
        $detail = $this->caseDetail->build($caseFile->clientProfile, $caseFile, $submission);

        $review = $this->advisor->buildStructuredReview([
            'client' => ['name' => $caseFile->clientProfile?->user?->name],
            'case_file' => [
                'immigration_pathway' => $caseFile->immigration_pathway,
                'pathway_assessment_crs_score' => $caseFile->pathway_assessment_crs_score,
            ],
            'case_detail' => $detail,
            'workflow_phase' => 'assessment',
            'next_action' => ['title' => 'Consultant selects the final pathway'],
        ]);

        $payload = [
            'recommended_pathways' => $review['recommended_pathways'] ?? [],
            'catalog_suggestions' => $this->catalog->suggestForQuestionnaire($submission, 6),
            'risks' => $review['risks'] ?? [],
            'rationale' => $review['headline'] ?? '',
            'assessment_points' => $review['assessment_points'] ?? [],
            'verdict' => $review['verdict'] ?? null,
            'generated_at' => now()->toIso8601String(),
            'source' => 'maple_decision_support',
            'auto_selected' => false,
        ];

        $caseFile->update([
            'maple_recommendation' => $payload,
            'maple_recommended_at' => now(),
            'workflow_status' => $this->advanceToRecommended($caseFile),
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'maple_recommendation_generated',
            'Maple recommendation stored (decision support only)',
            $payload['rationale'] ?: null,
            $actor,
            [
                'auto_selected' => false,
                'forbidden' => MapleAiBoundaries::FORBIDDEN_ACTIONS,
            ],
        );

        return $payload;
    }

    private function advanceToRecommended(CaseFile $caseFile): string
    {
        $current = CaseWorkflowStatus::resolveForCase($caseFile->workflow_status, $caseFile->status);
        $order = CaseWorkflowStatus::ORDER[$current] ?? 0;
        $target = CaseWorkflowStatus::ORDER[CaseWorkflowStatus::PATHWAY_RECOMMENDED];

        return $order >= $target ? $current : CaseWorkflowStatus::PATHWAY_RECOMMENDED;
    }
}

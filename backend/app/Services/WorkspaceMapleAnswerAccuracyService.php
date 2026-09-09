<?php

namespace App\Services;

/**
 * Case-grounded accuracy estimate for Maple chat replies.
 * Not a legal guarantee — measures how well the answer can be backed by on-file case data.
 */
class WorkspaceMapleAnswerAccuracyService
{
    /**
     * @param  array<string, mixed>  $context  Full case context (or compact + facts)
     * @return array{
     *   score: int,
     *   label: string,
     *   level: 'high'|'medium'|'low',
     *   basis: list<string>,
     *   gaps: list<string>,
     *   disclaimer: string
     * }
     */
    public function assess(array $context, string $question, string $reply, bool $openAiUsed): array
    {
        $facts = $context['case_facts'] ?? [];
        $caseFile = $context['case_file'] ?? [];
        $detail = $context['case_detail'] ?? [];
        $gaps = collect($context['questionnaire_gaps'] ?? [])->pluck('label')->filter()->take(5)->values()->all();

        $signals = [];
        $basis = [];
        $missing = [];

        $hasName = filled(data_get($facts, 'main_applicant.display_name')
            ?? data_get($facts, 'main_applicant.full_name')
            ?? data_get($facts, 'account.name'));
        $hasStage = filled(data_get($caseFile, 'status'));
        $hasPathway = filled(data_get($caseFile, 'immigration_pathway'));
        $hasCrs = data_get($detail, 'crs_estimate.crs_total') !== null
            || data_get($context, 'crs_estimate.crs_total') !== null;
        $hasNext = filled(data_get($context, 'next_action.title'));
        $hasQuestionnaire = (bool) data_get($context, 'questionnaire.has_submission', false);
        $hasDocs = ($context['uploaded_documents'] ?? []) !== [];
        $blockerCount = count($context['questionnaire_gaps'] ?? []);

        if ($hasName) {
            $signals[] = 12;
            $basis[] = 'Applicant identity on file';
        } else {
            $missing[] = 'Main applicant name';
        }

        if ($hasStage) {
            $signals[] = 14;
            $basis[] = 'Case stage known';
        } else {
            $missing[] = 'Case stage';
        }

        if ($hasPathway) {
            $signals[] = 14;
            $basis[] = 'Pathway assigned';
        } else {
            $missing[] = 'Immigration pathway';
        }

        if ($hasNext) {
            $signals[] = 10;
            $basis[] = 'Next workflow action defined';
        }

        if ($hasQuestionnaire) {
            $signals[] = 12;
            $basis[] = 'Questionnaire on file';
        } else {
            $missing[] = 'Questionnaire submission';
        }

        if ($hasCrs) {
            $signals[] = 8;
            $basis[] = 'CRS estimate available';
        }

        if ($hasDocs) {
            $signals[] = 6;
            $basis[] = 'Attached Maple documents';
        }

        if ($blockerCount === 0) {
            $signals[] = 6;
            $basis[] = 'No open questionnaire blockers';
        } elseif ($blockerCount <= 3) {
            $signals[] = 3;
            $basis[] = 'Few blockers flagged';
        } else {
            $missing[] = 'Multiple questionnaire gaps still open';
        }

        $replyLower = mb_strtolower($reply);
        $hedges = ['not on file', "don't have", 'do not have', 'missing', 'unclear', 'cannot confirm', "i'm not sure", 'verify', 'insufficient'];
        $hedgeHits = 0;
        foreach ($hedges as $h) {
            if (str_contains($replyLower, $h)) {
                $hedgeHits++;
            }
        }

        // Honest uncertainty slightly reduces score but is preferred over invention
        $uncertaintyPenalty = min(12, $hedgeHits * 3);

        $coverage = array_sum($signals);
        $modeBonus = $openAiUsed ? 8 : 4;
        $score = (int) max(18, min(98, $coverage + $modeBonus - $uncertaintyPenalty));

        // Question type adjustments
        $q = mb_strtolower($question);
        if ($this->asksLaw($q) && ! $this->knowledgePresent($context)) {
            $score = min($score, 62);
            $missing[] = 'Synced legislation excerpt for this question';
        }

        if ($this->asksOverview($q) && $hasName && $hasStage) {
            $score = min(96, $score + 4);
        }

        $level = $score >= 80 ? 'high' : ($score >= 55 ? 'medium' : 'low');
        $label = match ($level) {
            'high'   => 'High case grounding',
            'medium' => 'Partial case grounding',
            default  => 'Limited case data',
        };

        return [
            'score'      => $score,
            'label'      => $label,
            'level'      => $level,
            'basis'      => array_slice($basis, 0, 5),
            'gaps'       => array_values(array_unique(array_merge(
                array_slice($missing, 0, 4),
                array_slice($gaps, 0, 2),
            ))),
            'disclaimer' => 'Case-grounding estimate only — not a legal accuracy guarantee. Confirm against IRCC rules and your RCIC judgment.',
        ];
    }

    private function asksLaw(string $q): bool
    {
        foreach (['irpa', 'irpr', 'section', 'inadmiss', 'legislation', 'regulation', 'residency obligation'] as $n) {
            if (str_contains($q, $n)) {
                return true;
            }
        }

        return false;
    }

    private function asksOverview(string $q): bool
    {
        foreach (['about this client', 'overview', 'summary', 'tell me about', 'who is'] as $n) {
            if (str_contains($q, $n)) {
                return true;
            }
        }

        return false;
    }

    /** @param  array<string, mixed>  $context */
    private function knowledgePresent(array $context): bool
    {
        $k = $context['immigration_knowledge'] ?? [];

        return ($k['legislation_excerpts'] ?? []) !== []
            || ($k['pathway_guides'] ?? []) !== []
            || ($k['admissibility_guides'] ?? []) !== [];
    }
}

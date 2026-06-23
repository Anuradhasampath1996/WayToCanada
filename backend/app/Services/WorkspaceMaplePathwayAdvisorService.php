<?php

namespace App\Services;

use App\Models\ExpressEntryDraw;

final class WorkspaceMaplePathwayAdvisorService
{
    public function __construct(
        private WorkspaceCaseLegislationService $caseLegislation,
    ) {}

    /**
     * Structured pathway review for Maple analyze panel (no duplicate prose blocks).
     *
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    public function buildStructuredReview(array $context): array
    {
        $facts    = $context['case_facts'] ?? [];
        $name     = $facts['main_applicant']['display_name'] ?? $context['client']['name'] ?? 'This client';
        $assigned = $context['case_file']['immigration_pathway'] ?? null;
        $crs      = $context['case_detail']['crs_estimate']['crs_total']
            ?? $context['case_file']['pathway_assessment_crs_score']
            ?? null;
        $main     = $context['case_detail']['questionnaire']['main_data'] ?? [];
        $step1    = $context['case_detail']['questionnaire']['step1_data'] ?? [];
        $draws    = $this->resolveDraws($context);
        $latestCutoff = $draws[0]['minimum_crs_score'] ?? null;
        $latestDraw   = $draws[0]['draw_name'] ?? null;

        $studiedCanada = strtolower((string) ($main['studiedInCanada'] ?? '')) === 'yes';
        $canadianWork  = strtolower((string) ($main['canadianWork'] ?? '')) === 'yes';
        $visaType      = (string) ($step1['visaType'] ?? $main['visaType'] ?? '');
        $phase         = (string) ($context['workflow_phase'] ?? '');

        $caseFacts = array_values(array_filter([
            $crs !== null ? 'Estimated CRS: '.$crs : null,
            $latestCutoff !== null
                ? 'Latest Express Entry cut-off: '.$latestCutoff.($latestDraw ? " ({$latestDraw})" : '')
                : null,
            $studiedCanada
                ? 'Studied in Canada: Yes'.(($inst = trim((string) ($main['canadaStudyInstitution'] ?? ''))) !== '' ? " — {$inst}" : '')
                : null,
            $canadianWork ? 'Canadian work experience: Yes' : null,
            $visaType !== '' ? 'Intended visa type: '.$visaType : null,
        ]));

        $assessment = $this->buildAssessment($assigned, $crs, $latestCutoff, $studiedCanada, $canadianWork, $main);
        $crsNotes   = $this->buildCrsNotes($crs, $latestCutoff);
        $risks      = $this->buildRisks($assigned, $studiedCanada, $canadianWork, $crs, $latestCutoff);
        $verdict    = $this->resolveVerdict($assigned, $studiedCanada, $canadianWork, $crs, $latestCutoff);
        $headline   = $this->buildHeadline($name, $assigned, $verdict);

        $nextTitle = $context['next_action']['title'] ?? 'Continue the case workflow';
        $rcicStep  = match ($phase) {
            'case_hub' => 'Document in pathway notes why '.($assigned ?: 'the assigned pathway').' still fits — or schedule a pathway change if client goals shifted.',
            'post_agreement', 'application_forms' => 'Continue the post-agreement workflow, then confirm whether '.($assigned ?: 'this pathway').' still fits before filing.',
            default => $this->consultantNextStep($context, $assigned),
        };

        return [
            'verdict'            => $verdict,
            'headline'           => $headline,
            'assigned_pathway'   => $assigned,
            'case_facts'         => $caseFacts,
            'assessment_points'  => $assessment,
            'crs_notes'          => $crsNotes,
            'risks'              => $risks,
            'rcic_next_step'     => $rcicStep,
            'recommended_pathways' => $this->suggestAlternatives($assigned, $studiedCanada, $canadianWork, $crs, $latestCutoff),
            'legislation_refs'   => $this->caseLegislation->relevantForCase($context, 5),
        ];
    }

    /**
     * @param  array<string, mixed>  $context
     * @param  list<array{role: string, content: string}>  $history
     */
    public function advise(array $context, string $message, array $history = []): string
    {
        $review = $this->buildStructuredReview($context);
        $lines  = [$review['headline'] ?? 'Pathway review'];

        if (! empty($review['case_facts'])) {
            $lines[] = '';
            $lines[] = 'Case facts';
            foreach ($review['case_facts'] as $fact) {
                $lines[] = '• '.$fact;
            }
        }

        if (! empty($review['assessment_points'])) {
            $lines[] = '';
            $lines[] = 'Assessment';
            foreach ($review['assessment_points'] as $point) {
                $lines[] = '• '.$point;
            }
        }

        if (! empty($review['crs_notes'])) {
            $lines[] = '';
            $lines[] = $review['crs_notes'];
        }

        $lines[] = '';
        $lines[] = 'Next step: '.($review['rcic_next_step'] ?? 'Continue workflow.');
        $lines[] = '';
        $lines[] = 'Workflow guidance only — confirm eligibility and client goals before advising.';

        return implode("\n", $lines);
    }

    /** @param list<array{role: string, content: string}> $history */
    public function historyAboutPathway(array $history): bool
    {
        foreach (array_reverse(array_slice($history, -6)) as $turn) {
            $c = strtolower($turn['content'] ?? '');
            if (str_contains($c, 'pathway') || str_contains($c, 'study permit')
                || str_contains($c, 'express entry') || str_contains($c, 'pnp')) {
                return true;
            }
        }

        return false;
    }

    /** @param array<string, mixed> $context @return list<array<string, mixed>> */
    private function resolveDraws(array $context): array
    {
        $draws = $context['immigration_knowledge']['express_entry_draws'] ?? [];
        if ($draws !== []) {
            return $draws;
        }

        return ExpressEntryDraw::orderByDesc('draw_date')
            ->orderByDesc('draw_number')
            ->limit(3)
            ->get()
            ->map(fn (ExpressEntryDraw $d) => [
                'draw_name'           => $d->draw_name,
                'minimum_crs_score'   => $d->minimum_crs_score,
            ])
            ->all();
    }

    private function buildHeadline(string $name, ?string $assigned, string $verdict): string
    {
        $pathway = $assigned ?: 'No pathway assigned';

        return match ($verdict) {
            'review_needed' => "Pathway review for {$name}: {$pathway} is assigned, but the profile suggests you should confirm the route before filing.",
            'consider_alternatives' => "Pathway review for {$name}: {$pathway} may not be the strongest fit — compare alternatives below.",
            default => "Pathway review for {$name}: {$pathway} looks reasonable on current data.",
        };
    }

    private function resolveVerdict(?string $pathway, bool $studiedCanada, bool $canadianWork, mixed $crs, mixed $cutoff): string
    {
        $pathwayLower = strtolower((string) $pathway);
        $crsInt = is_numeric($crs) ? (int) $crs : null;

        if ($pathwayLower !== '' && str_contains($pathwayLower, 'study') && $studiedCanada && $canadianWork) {
            return 'review_needed';
        }

        if ($pathwayLower !== '' && str_contains($pathwayLower, 'study') && $studiedCanada && ! $canadianWork) {
            return 'review_needed';
        }

        if ($crsInt !== null && is_numeric($cutoff) && $crsInt >= (int) $cutoff
            && $pathwayLower !== '' && ! str_contains($pathwayLower, 'express')) {
            return 'consider_alternatives';
        }

        return 'reasonable';
    }

    private function buildCrsNotes(mixed $crs, mixed $latestCutoff): ?string
    {
        if (! is_numeric($crs)) {
            return null;
        }

        $crsInt = (int) $crs;
        if (! is_numeric($latestCutoff)) {
            return "CRS estimate is {$crsInt}. Compare against recent Express Entry draws in the pathway calculator.";
        }

        $cutoff = (int) $latestCutoff;
        $gap    = $cutoff - $crsInt;

        if ($gap > 80) {
            return "CRS {$crsInt} is well below the latest cut-off {$cutoff} (gap {$gap}). Express Entry is unlikely short term — temporary status or PNP may be more realistic while PR is long term.";
        }

        if ($gap > 0) {
            return "CRS {$crsInt} is below the latest cut-off {$cutoff} by {$gap} points — language, Canadian experience, or PNP may close the gap.";
        }

        return "CRS {$crsInt} meets or exceeds the latest cut-off {$cutoff} — Express Entry should stay on the table if eligibility criteria are met.";
    }

    /** @return list<string> */
    private function buildRisks(?string $pathway, bool $studiedCanada, bool $canadianWork, mixed $crs, mixed $cutoff): array
    {
        $risks = [];
        $pathwayLower = strtolower((string) $pathway);

        if (str_contains($pathwayLower, 'study') && $studiedCanada) {
            $risks[] = 'Client already studied in Canada — a new Study Permit may be the wrong tool unless there is a new LOA/program, restoration, or change of status.';
        }

        if ($canadianWork && str_contains($pathwayLower, 'study')) {
            $risks[] = 'Canadian work experience is on file — PGWP/CEC or employer-supported routes may fit better than another study permit.';
        }

        if (is_numeric($crs) && is_numeric($cutoff) && ((int) $cutoff - (int) $crs) > 80) {
            $risks[] = 'Low CRS vs recent draws — do not rely on Express Entry as the near-term plan unless scores improve.';
        }

        return $risks;
    }

    /** @return list<string> */
    private function suggestAlternatives(?string $pathway, bool $studiedCanada, bool $canadianWork, mixed $crs, mixed $cutoff): array
    {
        $alts = [];
        $pathwayLower = strtolower((string) $pathway);

        if (str_contains($pathwayLower, 'study') && $studiedCanada && $canadianWork) {
            $alts[] = 'Canadian Experience Class (CEC)';
            $alts[] = 'PGWP / work permit extension';
            $alts[] = 'Provincial Nominee Program';
        } elseif (str_contains($pathwayLower, 'study') && $studiedCanada) {
            $alts[] = 'Study permit extension or new LOA';
            $alts[] = 'PGWP (if eligible)';
        }

        if (is_numeric($crs) && is_numeric($cutoff) && (int) $crs >= (int) $cutoff) {
            $alts[] = 'Express Entry';
        }

        return array_values(array_unique($alts));
    }

    /**
     * @param  array<string, mixed>  $main
     * @return list<string>
     */
    private function buildAssessment(?string $pathway, mixed $crs, mixed $latestCutoff, bool $studiedCanada, bool $canadianWork, array $main): array
    {
        $points = [];
        $pathwayLower = strtolower((string) $pathway);
        $crsInt = is_numeric($crs) ? (int) $crs : null;
        $cutoff = is_numeric($latestCutoff) ? (int) $latestCutoff : null;

        if ($pathwayLower !== '' && str_contains($pathwayLower, 'study')) {
            if ($studiedCanada && $canadianWork) {
                $points[] = 'Profile shows prior Canadian study plus Canadian work — confirm whether the client needs another study permit or should pivot to PGWP/CEC/PNP instead.';
            } elseif ($studiedCanada) {
                $points[] = 'Prior Canadian study is on file — verify whether this is an extension, new program (LOA/DLI), or restoration rather than a first-time study permit.';
            } else {
                $points[] = 'Study Permit is assigned, but completed Canadian study is not on file — verify LOA/DLI, funds, and genuine study intent.';
            }
        }

        if ($crsInt !== null && $cutoff !== null) {
            $gap = $cutoff - $crsInt;
            if ($gap > 80) {
                $points[] = "Express Entry is not competitive now (CRS {$crsInt} vs cut-off {$cutoff}). Keep PR as a longer-term goal via temporary status or PNP.";
            }
        } elseif ($crsInt !== null && $cutoff === null) {
            $points[] = "CRS estimate is {$crsInt} — compare against recent draws in the pathway calculator.";
        }

        if ($canadianWork) {
            $points[] = 'Canadian work supports CEC and some PNP streams after valid temporary status.';
        }

        $foreign = $this->humanizeForeignWork($main['workExperience'] ?? null);
        if ($foreign) {
            $points[] = "Foreign work on file: {$foreign} — supports FSW/CRS if documented.";
        }

        if ($crsInt !== null && $cutoff !== null && $crsInt >= $cutoff) {
            $points[] = "CRS {$crsInt} is at/above cut-off {$cutoff} — Express Entry remains relevant alongside the assigned pathway.";
        }

        if ($points === []) {
            $points[] = 'Run the pathway calculator with full questionnaire data before finalizing strategy.';
        }

        return array_slice($points, 0, 4);
    }

    /** @param array<string, mixed> $context */
    private function consultantNextStep(array $context, ?string $pathway): string
    {
        $next = $context['next_action']['title'] ?? null;
        if ($next) {
            return $next.' — document why '.($pathway ?: 'the chosen pathway').' fits in assessment notes.';
        }

        return 'Open the pathway calculator, save assessment notes, and record why the chosen route fits this client.';
    }

    private function humanizeForeignWork(mixed $value): ?string
    {
        return match (strtolower((string) $value)) {
            '3_or_more' => '3+ years',
            '1_to_2'    => '1–2 years',
            default     => trim((string) $value) !== '' ? (string) $value : null,
        };
    }
}

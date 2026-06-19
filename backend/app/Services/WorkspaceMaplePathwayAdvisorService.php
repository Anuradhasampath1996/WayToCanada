<?php

namespace App\Services;

final class WorkspaceMaplePathwayAdvisorService
{
    /**
     * @param  array<string, mixed>  $context
     * @param  list<array{role: string, content: string}>  $history
     */
    public function advise(array $context, string $message, array $history = []): string
    {
        $facts   = $context['case_facts'] ?? [];
        $name    = $facts['main_applicant']['display_name'] ?? 'This client';
        $assigned = $context['case_file']['immigration_pathway'] ?? null;
        $crs     = $context['case_detail']['crs_estimate']['crs_total']
            ?? $context['case_file']['pathway_assessment_crs_score']
            ?? null;
        $main    = $context['case_detail']['questionnaire']['main_data'] ?? [];
        $step1   = $context['case_detail']['questionnaire']['step1_data'] ?? [];
        $draws   = $context['immigration_knowledge']['express_entry_draws'] ?? [];
        $latestCutoff = $draws[0]['minimum_crs_score'] ?? null;
        $latestDraw   = $draws[0]['draw_name'] ?? null;

        $pathway = $assigned ?? $this->pathwayFromHistory($history);
        $studiedCanada = strtolower((string) ($main['studiedInCanada'] ?? '')) === 'yes';
        $canadianWork  = strtolower((string) ($main['canadianWork'] ?? '')) === 'yes';
        $visaType      = (string) ($step1['visaType'] ?? $main['visaType'] ?? '');

        $lines = [];
        $lines[] = "Pathway review for {$name}";

        if ($pathway) {
            $lines[] = '';
            $lines[] = 'Assigned pathway';
            $lines[] = '• '.$pathway;
        } else {
            $lines[] = '';
            $lines[] = 'No pathway assigned yet — run the pathway calculator after questionnaire review.';
        }

        $lines[] = '';
        $lines[] = 'Case facts I used';
        if ($crs !== null) {
            $lines[] = '• Estimated CRS: '.$crs;
        }
        if ($latestCutoff !== null) {
            $lines[] = '• Latest Express Entry cut-off: '.$latestCutoff
                .($latestDraw ? " ({$latestDraw})" : '');
        }
        if ($studiedCanada) {
            $inst = trim((string) ($main['canadaStudyInstitution'] ?? ''));
            $lines[] = '• Studied in Canada: Yes'.($inst !== '' ? " — {$inst}" : '');
        }
        if ($canadianWork) {
            $lines[] = '• Canadian work experience: Yes';
        }
        if ($visaType !== '') {
            $lines[] = '• Intended visa type (questionnaire): '.$visaType;
        }

        $lines[] = '';
        $lines[] = 'My assessment';

        foreach ($this->buildAssessment($pathway, $crs, $latestCutoff, $studiedCanada, $canadianWork, $main) as $point) {
            $lines[] = '• '.$point;
        }

        $lines[] = '';
        $lines[] = 'Next step for you as RCIC';
        $lines[] = '• '.$this->consultantNextStep($context, $pathway);

        $lines[] = '';
        $lines[] = 'This is workflow guidance only — confirm eligibility, policy updates, and client goals before advising.';

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
            if ($studiedCanada) {
                $points[] = 'Study Permit aligns with the fact that this client already studied in Canada — useful for extensions, compliance, or study-related strategy before PR.';
            } else {
                $points[] = 'Study Permit is assigned, but the questionnaire does not show completed Canadian study yet — verify study intent, LOA/DLI, and funds before relying on this route.';
            }
        }

        if ($crsInt !== null && $cutoff !== null) {
            $gap = $cutoff - $crsInt;
            if ($gap > 80) {
                $points[] = "Express Entry is not competitive right now (CRS {$crsInt} vs recent cut-off {$cutoff}). A temporary route (study/work/PNP) may be more realistic short term.";
            } elseif ($gap > 0) {
                $points[] = "CRS {$crsInt} is below the latest cut-off {$cutoff}, but not far — language, Canadian work, or PNP could close the gap.";
            } else {
                $points[] = "CRS {$crsInt} meets or exceeds the latest cut-off {$cutoff} — Express Entry should stay on the table if eligibility criteria are met.";
            }
        } elseif ($crsInt !== null) {
            $points[] = "CRS estimate is {$crsInt} — compare against recent draws in the pathway calculator.";
        }

        if ($canadianWork) {
            $points[] = 'Canadian work experience supports CEC and some PNP streams after temporary status.';
        }

        $foreign = $this->humanizeForeignWork($main['workExperience'] ?? null);
        if ($foreign) {
            $points[] = "Foreign work on file: {$foreign} — relevant for FSW/CRS if properly documented.";
        }

        if ($points === []) {
            $points[] = 'Complete questionnaire review and pathway calculator to compare Study, Work, Express Entry, and PNP options with full data.';
        }

        if ($pathway && ! str_contains($pathwayLower, 'express') && $crsInt !== null && $cutoff !== null && $crsInt >= $cutoff) {
            $points[] = 'Even with another pathway assigned, strong CRS means Express Entry remains worth comparing before you finalize strategy.';
        }

        return array_slice($points, 0, 5);
    }

    /** @param array<string, mixed> $context */
    private function consultantNextStep(array $context, ?string $pathway): string
    {
        $next = $context['next_action']['title'] ?? null;
        if ($next) {
            return $next.' — then document why '.($pathway ?: 'the chosen pathway').' fits this profile in your assessment notes.';
        }

        return 'Open the pathway calculator, save assessment notes, and record why the chosen route fits this client.';
    }

    /** @param list<array{role: string, content: string}> $history */
    private function pathwayFromHistory(array $history): ?string
    {
        foreach (array_reverse(array_slice($history, -6)) as $turn) {
            $c = $turn['content'] ?? '';
            if (preg_match('/pathway is\s+([^.]+)/i', $c, $m)) {
                return trim($m[1]);
            }
            if (preg_match('/assigned immigration pathway is\s+([^.]+)/i', $c, $m)) {
                return trim($m[1]);
            }
        }

        return null;
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

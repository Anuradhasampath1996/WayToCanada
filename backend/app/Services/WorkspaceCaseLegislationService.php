<?php

namespace App\Services;

use App\Models\LegislationProvision;

class WorkspaceCaseLegislationService
{
    public function __construct(
        private LegislationHubLinkService $hubLinks,
        private LegislationSyncService $sync,
    ) {}

    /**
     * @param  array<string, mixed>  $context
     * @return list<array<string, mixed>>
     */
    public function relevantForCase(array $context, int $limit = 8): array
    {
        $refs  = [];
        $pathway = strtolower((string) ($context['case_file']['immigration_pathway'] ?? ''));
        $visaType = strtolower((string) ($context['case_detail']['questionnaire']['step1_data']['visaType']
            ?? $context['case_detail']['questionnaire']['main_data']['visaType'] ?? ''));

        foreach (config('maple_case_legislation.pathway_sections', []) as $needle => $sections) {
            if ($pathway !== '' && str_contains($pathway, $needle)) {
                $refs = array_merge($refs, $sections);
            } elseif ($visaType !== '' && str_contains($visaType, $needle)) {
                $refs = array_merge($refs, $sections);
            }
        }

        if ($this->caseMentionsInadmissibility($context)) {
            $refs = array_merge($refs, config('maple_case_legislation.topic_sections.inadmissibility', []));
        }

        $flags = $context['case_detail']['inadmissibility_flags'] ?? $context['inadmissibility_flags'] ?? [];
        if (is_array($flags) && $flags !== []) {
            $refs = array_merge($refs, config('maple_case_legislation.topic_sections.inadmissibility', []));
        }

        if (str_contains(strtolower($pathway), 'express') || str_contains($pathway, 'crs')) {
            $refs = array_merge($refs, config('maple_case_legislation.pathway_sections.express entry', []));
        }

        $refs = $this->uniqueRefs($refs);
        $refs = array_slice($refs, 0, $limit);

        return $this->hydrateRefs($refs, 'en');
    }

    /**
     * @param  list<array{act_code: string, provision_key: string, reason?: string}>  $refs
     * @return list<array<string, mixed>>
     */
    private function hydrateRefs(array $refs, string $language): array
    {
        $out = [];
        foreach ($refs as $ref) {
            $resolved = $this->sync->resolveReference($ref['act_code'], $ref['provision_key'], $language);
            $link     = $this->hubLinks->buildLink($ref['act_code'], $ref['provision_key'], $language);

            $out[] = array_merge($link, [
                'reason'       => $ref['reason'] ?? null,
                'marginal_note'=> $resolved['marginal_note'] ?? null,
                'excerpt'      => mb_substr(trim(strip_tags((string) ($resolved['text_content'] ?? ''))), 0, 220),
                'available'    => $resolved !== null,
            ]);
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function caseMentionsInadmissibility(array $context): bool
    {
        $blob = strtolower(json_encode([
            $context['case_file']['immigration_pathway'] ?? '',
            $context['case_detail']['questionnaire']['main_data'] ?? [],
            $context['case_detail']['questionnaire']['step1_data'] ?? [],
        ]));

        foreach (['inadmiss', 'criminal', 'medical', 'misrepresent', 'refusal'] as $needle) {
            if (str_contains($blob, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<array{act_code: string, provision_key: string}>  $refs
     * @return list<array{act_code: string, provision_key: string, reason?: string}>
     */
    private function uniqueRefs(array $refs): array
    {
        $seen = [];
        $out  = [];
        foreach ($refs as $ref) {
            $key = ($ref['act_code'] ?? '').'::'.($ref['provision_key'] ?? '');
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[]      = $ref;
        }

        return $out;
    }
}

<?php

namespace App\Support;

use App\Models\CaseFile;
use App\Services\CaseManagementHubService;

final class EligibilityAssessmentRouter
{
    /**
     * @return array{
     *   family: ?string,
     *   registry_key: string,
     *   mode: string,
     *   calculators: list<string>,
     *   checklist: list<array{id: string, label: string}>
     * }
     */
    public static function for(?CaseFile $caseFile, ?string $familyHint = null, ?string $pathwayCode = null, ?string $pathwayLabel = null): array
    {
        $code = $pathwayCode ?? $caseFile?->pathway_code;
        $label = $pathwayLabel ?? $caseFile?->immigration_pathway;
        $family = $familyHint
            ?: CaseManagementHubService::pathwayFamily($label)
            ?: ($caseFile ? CaseManagementHubService::pathwayFamily($caseFile->immigration_pathway) : null);

        $key = PathwayRequirementCatalog::resolveKey($code, $family, $label);
        $definition = PathwayRequirementCatalog::definitions()[$key] ?? PathwayRequirementCatalog::definitions()['default'];
        $calculators = $definition['calculators'] ?? [];
        $mode = in_array('crs', $calculators, true) ? 'express_entry' : 'checklist';

        return [
            'family' => $family,
            'registry_key' => $key,
            'mode' => $mode,
            'calculators' => $calculators,
            'checklist' => self::checklist($key, $definition),
        ];
    }

    /**
     * @param  array<string, mixed>  $definition
     * @return list<array{id: string, label: string}>
     */
    private static function checklist(string $key, array $definition): array
    {
        $items = [
            ['id' => 'identity', 'label' => 'Confirm identity, passport, and civil status facts'],
            ['id' => 'intent', 'label' => 'Confirm client goal and intended application type'],
        ];

        foreach ($definition['extra_fields'] ?? [] as $field) {
            $items[] = [
                'id' => (string) ($field['key'] ?? $field['label'] ?? 'field'),
                'label' => 'Collect: '.($field['label'] ?? $field['key']),
            ];
        }

        $items[] = match ($key) {
            'Study Permit' => ['id' => 'study_core', 'label' => 'Verify LOA/DLI, program dates, and proof of funds'],
            'Work Permit' => ['id' => 'work_core', 'label' => 'Verify job offer, LMIA/exemption, and employer details'],
            'Family Sponsorship', 'Family Sponsorship – PGP' => ['id' => 'sponsor_core', 'label' => 'Verify sponsor status, relationship, and income/MNI'],
            'Visitor' => ['id' => 'visitor_core', 'label' => 'Verify purpose of visit, ties to home country, and funds'],
            'PNP' => ['id' => 'pnp_core', 'label' => 'Verify provincial stream, nomination, and job offer if required'],
            'Citizenship' => ['id' => 'cit_core', 'label' => 'Verify physical presence, language, and PR status'],
            'PR Card' => ['id' => 'pr_card_core', 'label' => 'Verify travel history and current/expired PR card'],
            default => ['id' => 'eligibility_docs', 'label' => 'Review language, education, and work evidence against the stream'],
        };

        return $items;
    }
}

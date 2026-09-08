<?php

namespace App\Services\GovernmentForms;

use App\Data\GovernmentForms\CanonicalDataSet;
use App\Data\GovernmentForms\FormReadinessResult;
use App\Models\GovernmentFormVersion;
use App\Support\GovernmentForms\CanonicalKeyLabel;

class FormReadinessService
{
    /** @var array<string, array<int, array{key: string, label: string, source_section: string, responsible_party: string, redirect_hint: string|null, conditional: bool}>> */
    private array $rules;

    public function __construct(
        private Imm5406FamilyCapacityService $imm5406Capacity,
    ) {
        $this->rules = config('government_forms.readiness', []);
    }

    public function assess(GovernmentFormVersion $version, CanonicalDataSet $canonical): FormReadinessResult
    {
        $formCode = strtoupper($version->form_code);
        $rules = $this->rules[$formCode] ?? $this->rulesFromMappings($version);

        if ($formCode === 'IMM5406') {
            $rules = $this->applyImm5406ConditionalRules($rules, $canonical);
        }

        $required = array_values(array_filter($rules, fn ($rule) => ($rule['conditional'] ?? false) === false));
        $missing = [];
        $filled = 0;

        foreach ($required as $rule) {
            $key = $rule['key'];
            if ($this->hasValue($canonical, $key)) {
                $filled++;
            } else {
                $missing[] = [
                    'key'            => $key,
                    'label'          => $rule['label'],
                    'source_section' => $rule['source_section'],
                    'responsible_party' => $rule['responsible_party'],
                    'redirect_hint'  => $rule['redirect_hint'] ?? null,
                ];
            }
        }

        $overflowWarnings = [];
        $blockedByOverflow = false;

        if ($formCode === 'IMM5406') {
            $capacity = $this->imm5406Capacity->assess($canonical);
            $overflowWarnings = $capacity['warnings'];
            $blockedByOverflow = $capacity['blocked'];

            foreach ($overflowWarnings as $warning) {
                $missing[] = [
                    'key'            => 'overflow.'.$warning['section'],
                    'label'          => $warning['label'].' capacity exceeded',
                    'source_section' => 'questionnaire_family',
                    'responsible_party' => 'client',
                    'redirect_hint'  => '/questionnaire/accompanying',
                ];
            }
        }

        $total = count($required);
        $percentage = $total > 0 ? (int) round(($filled / $total) * 100) : 100;
        $ready = $missing === [] && ! $blockedByOverflow;

        return new FormReadinessResult(
            formCode: $formCode,
            percentage: $ready ? 100 : min($percentage, $blockedByOverflow ? min($percentage, 99) : $percentage),
            ready: $ready,
            missingFields: $missing,
            requiredCount: $total,
            filledCount: $filled,
            overflowWarnings: $overflowWarnings,
            blockedByOverflow: $blockedByOverflow,
        );
    }

    /**
     * @param  array<int, array{key: string, label: string, source_section: string, responsible_party: string, redirect_hint: string|null, conditional: bool}>  $rules
     * @return array<int, array{key: string, label: string, source_section: string, responsible_party: string, redirect_hint: string|null, conditional: bool}>
     */
    private function applyImm5406ConditionalRules(array $rules, CanonicalDataSet $canonical): array
    {
        if ($canonical->get('applicant.flags.married') !== 'yes') {
            return array_values(array_filter(
                $rules,
                fn ($rule) => ! str_starts_with($rule['key'], 'applicant.family.spouse.'),
            ));
        }

        $spouseRequired = [
            [
                'key' => 'applicant.family.spouse.family_name',
                'label' => 'Spouse family name',
                'source_section' => 'questionnaire_spouse',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/spouse',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.family.spouse.given_names',
                'label' => 'Spouse given names',
                'source_section' => 'questionnaire_spouse',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/spouse',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.family.spouse.date_of_birth',
                'label' => 'Spouse date of birth',
                'source_section' => 'questionnaire_spouse',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/spouse',
                'conditional' => false,
            ],
        ];

        return array_merge($rules, $spouseRequired);
    }

    /** @return array<int, array{key: string, label: string, source_section: string, responsible_party: string, redirect_hint: string|null, conditional: bool}> */
    private function rulesFromMappings(GovernmentFormVersion $version): array
    {
        return $version->mappings()
            ->where('is_required', true)
            ->orderBy('sort_order')
            ->get()
            ->map(fn ($mapping) => [
                'key'               => $mapping->canonical_key,
                'label'             => $this->humanizeKey($mapping->canonical_key),
                'source_section'    => $this->inferSourceSection($mapping->canonical_key),
                'responsible_party' => 'client',
                'redirect_hint'     => $this->inferRedirectHint($mapping->canonical_key),
                'conditional'       => false,
            ])
            ->values()
            ->all();
    }

    private function hasValue(CanonicalDataSet $canonical, string $key): bool
    {
        $value = $canonical->get($key);

        return $value !== null && $value !== '';
    }

    private function humanizeKey(string $key): string
    {
        return CanonicalKeyLabel::from($key);
    }

    private function inferSourceSection(string $key): string
    {
        if (str_starts_with($key, 'representative.')) {
            return 'consultant_profile';
        }

        if (str_contains($key, 'family.spouse')) {
            return 'questionnaire_spouse';
        }

        if (str_contains($key, 'family.children')) {
            return 'questionnaire_children';
        }

        if (str_contains($key, 'family.parent')) {
            return 'questionnaire_accompanying';
        }

        if (str_contains($key, 'family.siblings')) {
            return 'questionnaire_accompanying';
        }

        return 'questionnaire_main';
    }

    private function inferRedirectHint(string $key): ?string
    {
        return match (true) {
            str_starts_with($key, 'representative.') => '/consultant/profile',
            str_contains($key, 'family.spouse')    => '/questionnaire/spouse',
            str_contains($key, 'family.children')  => '/questionnaire/children',
            str_contains($key, 'family.parent'),
            str_contains($key, 'family.siblings')  => '/questionnaire/accompanying',
            default                                => '/questionnaire/main',
        };
    }
}

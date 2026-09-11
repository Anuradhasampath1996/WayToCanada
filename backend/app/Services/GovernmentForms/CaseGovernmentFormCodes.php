<?php

namespace App\Services\GovernmentForms;

use App\Http\Controllers\ApplicationPackageController;
use App\Models\CaseFile;
use App\Services\CaseManagementHubService;

/**
 * Resolves which IRCC form codes apply to a case (package / pathway),
 * and which of those are currently fillable via the government-forms registry.
 */
class CaseGovernmentFormCodes
{
    /** @var array<string, list<string>> Display codes with spaces, e.g. "IMM 5406" */
    private const PATHWAY_FORM_CODES = [
        'Express Entry' => [
            'IMM 0008',
            'IMM 5669',
            'IMM 5406',
            'IMM 5562',
        ],
        'PNP' => [
            'IMM 0008',
            'IMM 5669',
            'IMM 5406',
        ],
        'Family Sponsorship' => [
            'IMM 1344',
            'IMM 0008',
            'IMM 5540',
            'IMM 5490',
        ],
        'Study Permit' => [
            'IMM 1294',
            'IMM 5707',
        ],
        'Work Permit' => [
            'IMM 1295',
            'IMM 5707',
        ],
        'Community Pilot' => [
            'IMM 0008',
            'IMM 5669',
            'IMM 5406',
        ],
        'Quebec' => [
            'IMM 0008',
            'IMM 5669',
            'IMM 5406',
        ],
        'Business Immigration' => [
            'IMM 0008',
            'IMM 5669',
            'IMM 5406',
        ],
        'Visitor' => [
            'IMM 5257',
            'IMM 5707',
        ],
        'Citizenship' => [
            'CIT 0002',
        ],
        'PR Card' => [
            'IMM 5444',
            'IMM 5455',
        ],
    ];

    /**
     * @return array{
     *   fillable: list<string>,
     *   package_reference: list<array{code: string, name: string, normalized: string, fillable: bool}>
     * }
     */
    public function resolve(CaseFile $caseFile): array
    {
        $caseFile->loadMissing('assignedIrccCategory');
        $package = ApplicationPackageController::formatPackage(
            $caseFile->assignedIrccCategory,
            $caseFile->id
        );

        $displayCodes = $this->collectDisplayCodes($caseFile, $package);
        $supported = array_keys(config('government_forms.supported_forms', []));
        $supportedSet = array_fill_keys($supported, true);

        // Representative form is usually needed regardless of package list.
        if (isset($supportedSet['IMM5476']) && ! in_array('IMM5476', array_map([$this, 'normalize'], $displayCodes), true)) {
            array_unshift($displayCodes, 'IMM 5476');
        }

        $packageReference = [];
        $seenNormalized = [];
        $fillable = [];

        foreach ($displayCodes as $display) {
            $normalized = $this->normalize($display);
            if ($normalized === '' || isset($seenNormalized[$normalized])) {
                continue;
            }
            $seenNormalized[$normalized] = true;

            $isFillable = isset($supportedSet[$normalized]);
            if ($isFillable) {
                $fillable[] = $normalized;
            }

            $packageReference[] = [
                'code' => $display,
                'name' => $this->nameFor($display, $normalized),
                'normalized' => $normalized,
                'fillable' => $isFillable,
            ];
        }

        // Ensure every supported form that is fillable for this case appears even if
        // package list omitted it but we force-included it above; also keep stable order
        // matching supported_forms config for fillable subset when package empty.
        if ($fillable === [] && $supported !== []) {
            $fillable = array_values($supported);
            foreach ($fillable as $code) {
                if (isset($seenNormalized[$code])) {
                    continue;
                }
                $packageReference[] = [
                    'code' => $this->displayFromNormalized($code),
                    'name' => $this->nameFor($this->displayFromNormalized($code), $code),
                    'normalized' => $code,
                    'fillable' => true,
                ];
            }
        }

        return [
            'fillable' => array_values(array_unique($fillable)),
            'package_reference' => $packageReference,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $package
     * @return list<string>
     */
    private function collectDisplayCodes(CaseFile $caseFile, ?array $package): array
    {
        $codes = [];

        if ($package && ! empty($package['result']['forms']) && is_array($package['result']['forms'])) {
            foreach ($package['result']['forms'] as $code) {
                if (! is_string($code)) {
                    continue;
                }
                if ($code === 'Online Web Forms' || $code === 'Online Form') {
                    continue;
                }
                $codes[] = $code;
            }
        }

        $family = $this->resolvePathwayFamily($caseFile);
        $pathwayCodes = ($family && isset(self::PATHWAY_FORM_CODES[$family]))
            ? self::PATHWAY_FORM_CODES[$family]
            : [];

        // Merge package + pathway lists so Express Entry always gets IMM 0008 / 5669 / etc.
        // Package-only early return used to hide fillable forms when the IRCC leaf listed
        // only non-mapped / online placeholders.
        $merged = array_values(array_unique(array_merge($codes, $pathwayCodes)));

        return $merged;
    }

    private function resolvePathwayFamily(CaseFile $caseFile): ?string
    {
        try {
            $fromCatalog = app(\App\Services\PathwayCatalogService::class)->hubFamilyForCase($caseFile);
            if (is_string($fromCatalog) && $fromCatalog !== '') {
                return $fromCatalog;
            }
        } catch (\Throwable) {
            // Fall through to label-based family.
        }

        return CaseManagementHubService::pathwayFamily($caseFile->immigration_pathway);
    }

    public function normalize(string $code): string
    {
        $trimmed = trim($code);
        if ($trimmed === '' || strcasecmp($trimmed, 'Online') === 0) {
            return '';
        }

        // "IMM 5406" / "imm-5406" / "IMM5406" → IMM5406
        $compact = strtoupper(preg_replace('/[\s\-_]+/', '', $trimmed) ?? $trimmed);

        return $compact;
    }

    private function displayFromNormalized(string $normalized): string
    {
        if (preg_match('/^(IMM)(\d+)$/i', $normalized, $m)) {
            return strtoupper($m[1]).' '.$m[2];
        }

        return $normalized;
    }

    private function nameFor(string $display, string $normalized): string
    {
        $supported = config('government_forms.supported_forms.'.$normalized.'.name');
        if (is_string($supported) && $supported !== '') {
            return $supported;
        }

        return match ($display) {
            'IMM 0008' => 'Generic Application Form for Canada',
            'IMM 5669' => 'Schedule A — Background/Declaration',
            'IMM 5406' => 'Additional Family Information',
            'IMM 5476' => 'Use of a Representative',
            'IMM 5562' => 'Supplementary Information — Your Travels',
            'IMM 1344' => 'Application to Sponsor & Undertaking',
            'IMM 5540' => 'Sponsorship Agreement',
            'IMM 5490' => "Sponsor's Financial Evaluation",
            'IMM 1294' => 'Application for Study Permit',
            'IMM 1295' => 'Application for Work Permit',
            'IMM 5707' => 'Family Information',
            default => 'IRCC form '.$display,
        };
    }
}

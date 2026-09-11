<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\IrccCategory;
use App\Models\QuestionnaireSubmission;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Suggests (and can auto-assign) the IRCC application package leaf that matches
 * an immigration pathway. Uses a deterministic map first, then Maple/OpenAI to
 * refine ambiguous Study/Work inside-vs-outside choices from case facts.
 */
class IrccPackageSuggestionService
{
    /**
     * Pathway string → preferred leaf label (substring match, case-insensitive).
     *
     * @var array<string, list<string>>
     */
    private const PATHWAY_LEAF_PREFERENCES = [
        'Express Entry – Federal Skilled Worker' => ['Express Entry (FSW, CEC, FST)', 'Express Entry'],
        'Express Entry – Canadian Experience Class' => ['Express Entry (FSW, CEC, FST)', 'Express Entry'],
        'Express Entry – Federal Skilled Trades' => ['Express Entry (FSW, CEC, FST)', 'Express Entry'],
        'Provincial Nominee Program' => ['Provincial Nominee Program (PNP - Non-Express Entry)', 'Provincial Nominee'],
        'Study Permit' => [
            'Study permit from outside Canada',
            'Study permit from inside Canada',
            'Extend your study permit',
        ],
        'Work Permit' => [
            'Work permit from outside Canada',
            'Work permit from inside Canada',
        ],
        'Family Sponsorship' => [
            'Family Sponsorship — Spouse or Partner',
            'Family Sponsorship — Parents and Grandparents',
            'Family Sponsorship',
        ],
    ];

    /**
     * @return array{
     *   category: ?IrccCategory,
     *   path: list<array{id: int, label: string, level: int}>,
     *   source: 'deterministic'|'maple'|'none',
     *   reason: string,
     *   confidence: 'high'|'medium'|'low'
     * }
     */
    public function suggestForCase(CaseFile $caseFile, ?string $pathway = null): array
    {
        $pathway = $pathway ?? $caseFile->immigration_pathway;
        if ((! is_string($pathway) || trim($pathway) === '') && $caseFile->pathway_code) {
            try {
                $node = app(PathwayCatalogService::class)->findByCode($caseFile->pathway_code);
                $pathway = $node?->label;
            } catch (\Throwable $e) {
                Log::warning('[IrccPackageSuggestion] could not resolve pathway_code', [
                    'pathway_code' => $caseFile->pathway_code,
                    'error' => $e->getMessage(),
                ]);
            }
        }
        if (! is_string($pathway) || trim($pathway) === '') {
            return $this->empty('No pathway assigned.');
        }

        $leaves = IrccCategory::query()
            ->where('level', 3)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        if ($leaves->isEmpty()) {
            return $this->empty('No IRCC packages are configured.');
        }

        $preferences = $this->preferencesForPathway($pathway);
        $candidates = $this->matchLeaves($leaves, $preferences);

        // Keep preference order (not tree sort_order)
        if ($preferences !== [] && $candidates->isNotEmpty()) {
            $candidates = $this->orderByPreferences($candidates, $preferences);
        }

        if ($candidates->isEmpty()) {
            $candidates = $this->fuzzyPathwayLeaves($leaves, $pathway);
        }

        if ($candidates->isEmpty()) {
            return $this->empty('No IRCC package matched this pathway. Select manually.');
        }

        $facts = $this->caseFacts($caseFile);
        $picked = $candidates->first();
        $source = 'deterministic';
        $reason = 'Matched from pathway “'.$pathway.'”.';
        $confidence = $candidates->count() === 1 ? 'high' : 'medium';

        if ($candidates->count() > 1) {
            $refined = $this->maplePickAmong($pathway, $candidates, $facts);
            if ($refined) {
                $picked = $refined['category'];
                $source = $refined['source'];
                $reason = $refined['reason'];
                $confidence = $refined['confidence'];
            } else {
                $picked = $this->heuristicPick($pathway, $candidates, $facts);
                $reason = 'Multiple packages matched; chose the best default from case facts. Review if the client is already in Canada.';
                $confidence = 'medium';
            }
        }

        return [
            'category'   => $picked,
            'path'       => $this->breadcrumbPath($picked),
            'source'     => $source,
            'reason'     => $reason,
            'confidence' => $confidence,
        ];
    }

    /**
     * If assigned package does not match pathway suggestion (high/medium confidence),
     * re-assign automatically. Used to heal known mismatches (e.g. EE pathway + Super Visa package).
     *
     * @return array{healed: bool, suggestion: array<string, mixed>}
     */
    public function healMismatchIfNeeded(CaseFile $caseFile): array
    {
        $pathway = $caseFile->immigration_pathway;
        if (! is_string($pathway) || trim($pathway) === '') {
            return ['healed' => false, 'suggestion' => $this->empty('No pathway assigned.')];
        }

        $suggestion = $this->suggestForCase($caseFile, $pathway);
        $suggested = $suggestion['category'] ?? null;
        if (! $suggested instanceof IrccCategory) {
            return ['healed' => false, 'suggestion' => $suggestion];
        }

        $confidence = $suggestion['confidence'] ?? 'low';
        if (! in_array($confidence, ['high', 'medium'], true)) {
            return ['healed' => false, 'suggestion' => $suggestion];
        }

        if ((int) $caseFile->assigned_ircc_category_id === (int) $suggested->id) {
            return ['healed' => false, 'suggestion' => $suggestion];
        }

        $caseFile->update([
            'assigned_ircc_category_id'       => $suggested->id,
            'application_package_assigned_at' => now(),
            'application_forms_verified_at'   => null,
        ]);

        return [
            'healed'     => true,
            'suggestion' => [
                ...$suggestion,
                'category' => $suggested,
                'reason'   => ($suggestion['reason'] ?? '').' Previous package did not match the pathway, so Maple/rules re-assigned it.',
            ],
        ];
    }

    /**
     * Assign suggested package to the case when pathway is set/changed.
     *
     * @return array{assigned: bool, suggestion: array<string, mixed>}
     */
    public function autoAssignForPathway(CaseFile $caseFile, string $pathway): array
    {
        $suggestion = $this->suggestForCase($caseFile, $pathway);
        $category = $suggestion['category'] ?? null;

        if (! $category instanceof IrccCategory) {
            return ['assigned' => false, 'suggestion' => $suggestion];
        }

        $caseFile->update([
            'assigned_ircc_category_id'       => $category->id,
            'application_package_assigned_at' => now(),
            'application_forms_verified_at'   => null,
        ]);

        return [
            'assigned'   => true,
            'suggestion' => [
                ...$suggestion,
                'category' => $category,
            ],
        ];
    }

    /**
     * @param  list<string>  $preferences
     * @return \Illuminate\Support\Collection<int, IrccCategory>
     */
    private function matchLeaves($leaves, array $preferences)
    {
        if ($preferences === []) {
            return collect();
        }

        return $leaves->filter(function (IrccCategory $leaf) use ($preferences) {
            $label = mb_strtolower((string) $leaf->label);
            foreach ($preferences as $pref) {
                $p = mb_strtolower($pref);
                if ($label === $p || str_contains($label, $p)) {
                    return true;
                }
            }

            return false;
        })->values();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, IrccCategory>  $candidates
     * @param  list<string>  $preferences
     * @return \Illuminate\Support\Collection<int, IrccCategory>
     */
    private function orderByPreferences($candidates, array $preferences)
    {
        return $candidates->sortBy(function (IrccCategory $leaf) use ($preferences) {
            $label = mb_strtolower((string) $leaf->label);
            foreach ($preferences as $i => $pref) {
                $p = mb_strtolower($pref);
                if ($label === $p || str_contains($label, $p)) {
                    return $i;
                }
            }

            return 999;
        })->values();
    }

    /**
     * @return list<string>
     */
    private function preferencesForPathway(string $pathway): array
    {
        try {
            $catalog = app(PathwayCatalogService::class);
            $resolved = $catalog->resolve(null, $pathway);
            $fromNode = $catalog->packagePreferencesFor($resolved['node'] ?? null, $pathway);
            if ($fromNode !== []) {
                return $fromNode;
            }

            // Also try if pathway looks like a code
            $byCode = $catalog->findByCode($pathway);
            if ($byCode) {
                $prefs = $catalog->packagePreferencesFor($byCode);
                if ($prefs !== []) {
                    return $prefs;
                }
            }
        } catch (\Throwable $e) {
            Log::warning('[IrccPackageSuggestion] pathway catalog unavailable, using static map', [
                'pathway' => $pathway,
                'error' => $e->getMessage(),
            ]);
        }

        if (isset(self::PATHWAY_LEAF_PREFERENCES[$pathway])) {
            return self::PATHWAY_LEAF_PREFERENCES[$pathway];
        }

        $lower = mb_strtolower($pathway);

        foreach (self::PATHWAY_LEAF_PREFERENCES as $key => $prefs) {
            $k = mb_strtolower($key);
            if (str_contains($lower, $k) || str_contains($k, $lower)) {
                return $prefs;
            }
        }

        if (\App\Support\ImmigrationPathwayLabels::mentionsExpressEntry($pathway)) {
            return ['Express Entry (FSW, CEC, FST)', 'Express Entry'];
        }

        if (str_contains($lower, 'super visa')) {
            return ['Super Visa (Parents and Grandparents)', 'Super Visa'];
        }

        if (str_contains($lower, 'visitor') || str_contains($lower, 'trv')) {
            return ['Visitor visa (from outside Canada)', 'Visitor visa'];
        }

        return [];
    }

    /**
     * @return \Illuminate\Support\Collection<int, IrccCategory>
     */
    private function fuzzyPathwayLeaves($leaves, string $pathway)
    {
        $lower = mb_strtolower($pathway);
        $family = $this->pathwayFamily($lower);

        $stop = ['permit', 'program', 'canada', 'canadian', 'entry', 'from', 'with', 'your'];
        $tokens = collect(preg_split('/[\s–—\-\/]+/u', $lower) ?: [])
            ->map(fn ($t) => trim($t))
            ->filter(fn ($t) => mb_strlen($t) >= 4 && ! in_array($t, $stop, true))
            ->values();

        if ($tokens->isEmpty() && $family === null) {
            return collect();
        }

        return $leaves->filter(function (IrccCategory $leaf) use ($tokens, $family) {
            $label = mb_strtolower((string) $leaf->label);

            if ($family === 'work' && (str_contains($label, 'study') || str_contains($label, 'visitor') || str_contains($label, 'super visa'))) {
                return false;
            }
            if ($family === 'study' && (str_contains($label, 'work permit') || str_contains($label, 'visitor') || str_contains($label, 'super visa'))) {
                return false;
            }
            if ($family === 'express_entry' && ! \App\Support\ImmigrationPathwayLabels::mentionsExpressEntry($label)) {
                return false;
            }
            if ($family === 'pnp' && ! \App\Support\ImmigrationPathwayLabels::mentionsPnp($label)) {
                return false;
            }

            if ($tokens->isEmpty()) {
                return match ($family) {
                    'work' => str_contains($label, 'work'),
                    'study' => str_contains($label, 'study'),
                    default => false,
                };
            }

            $hits = $tokens->filter(fn ($t) => str_contains($label, $t))->count();

            return $hits >= max(1, (int) ceil($tokens->count() / 2));
        })->values();
    }

    private function pathwayFamily(string $pathwayLower): ?string
    {
        // PNP before Express Entry — "Non-Express Entry" must not classify as EE.
        if (\App\Support\ImmigrationPathwayLabels::mentionsPnp($pathwayLower)) {
            return 'pnp';
        }
        if (\App\Support\ImmigrationPathwayLabels::mentionsExpressEntry($pathwayLower)) {
            return 'express_entry';
        }
        if (str_contains($pathwayLower, 'study')) {
            return 'study';
        }
        if (str_contains($pathwayLower, 'work')) {
            return 'work';
        }
        if (str_contains($pathwayLower, 'family') || str_contains($pathwayLower, 'sponsor')) {
            return 'family';
        }
        if (str_contains($pathwayLower, 'super visa')) {
            return 'super_visa';
        }

        return null;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, IrccCategory>  $candidates
     * @param  array<string, mixed>  $facts
     */
    private function heuristicPick(string $pathway, $candidates, array $facts): IrccCategory
    {
        $inCanada = (bool) ($facts['likely_in_canada'] ?? false);
        $pathwayLower = mb_strtolower($pathway);

        if (str_contains($pathwayLower, 'study')) {
            $prefer = $inCanada ? 'inside' : 'outside';
            $match = $candidates->first(fn (IrccCategory $c) => str_contains(mb_strtolower($c->label), $prefer));

            return $match ?? $candidates->first();
        }

        if (str_contains($pathwayLower, 'work')) {
            $prefer = $inCanada ? 'inside' : 'outside';
            $match = $candidates->first(fn (IrccCategory $c) => str_contains(mb_strtolower($c->label), $prefer));

            return $match ?? $candidates->first();
        }

        // Prefer first preference order already in collection
        return $candidates->first();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, IrccCategory>  $candidates
     * @param  array<string, mixed>  $facts
     * @return array{category: IrccCategory, source: string, reason: string, confidence: string}|null
     */
    private function maplePickAmong(string $pathway, $candidates, array $facts): ?array
    {
        if (! $this->openAiAvailable()) {
            return null;
        }

        $options = $candidates->map(fn (IrccCategory $c) => [
            'id'    => $c->id,
            'label' => $c->label,
        ])->values()->all();

        $prompt = [
            'task' => 'Pick the single best IRCC application package leaf for this client pathway.',
            'assigned_pathway' => $pathway,
            'case_facts' => $facts,
            'options' => $options,
            'rules' => [
                'Return JSON only: {"id": number, "reason": string, "confidence": "high"|"medium"|"low"}',
                'id must be one of the option ids.',
                'Prefer outside-Canada packages unless facts clearly show the client is already in Canada.',
                'For Express Entry streams always prefer the Express Entry package.',
            ],
        ];

        try {
            $response = Http::withToken((string) config('services.openai.key'))
                ->timeout(20)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => config('services.openai.model', 'gpt-4o-mini'),
                    'temperature' => 0,
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'You are Maple, an RCIC assistant. Choose the correct IRCC application package accurately.',
                        ],
                        [
                            'role' => 'user',
                            'content' => json_encode($prompt, JSON_UNESCAPED_UNICODE),
                        ],
                    ],
                ]);

            if (! $response->successful()) {
                Log::warning('Maple package suggestion OpenAI failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                return null;
            }

            $content = (string) data_get($response->json(), 'choices.0.message.content', '');
            $parsed = json_decode($content, true);
            if (! is_array($parsed) || empty($parsed['id'])) {
                return null;
            }

            $id = (int) $parsed['id'];
            $chosen = $candidates->first(fn (IrccCategory $c) => $c->id === $id);
            if (! $chosen) {
                return null;
            }

            $confidence = in_array(($parsed['confidence'] ?? ''), ['high', 'medium', 'low'], true)
                ? $parsed['confidence']
                : 'medium';

            return [
                'category'   => $chosen,
                'source'     => 'maple',
                'reason'     => trim((string) ($parsed['reason'] ?? 'Maple selected this package for the pathway.')),
                'confidence' => $confidence,
            ];
        } catch (\Throwable $e) {
            Log::warning('Maple package suggestion exception: '.$e->getMessage());

            return null;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function caseFacts(CaseFile $caseFile): array
    {
        $caseFile->loadMissing('clientProfile.user');
        $userId = $caseFile->clientProfile?->user_id;
        $submission = $userId
            ? QuestionnaireSubmission::where('user_id', $userId)->first()
            : null;

        $main = is_array($submission?->main_data) ? $submission->main_data : [];
        $step1 = is_array($submission?->step1_data) ? $submission->step1_data : [];

        $studiedCanada = strtolower((string) ($main['studiedInCanada'] ?? '')) === 'yes';
        $canadianWork = strtolower((string) ($main['canadianWork'] ?? '')) === 'yes';
        $visaType = (string) ($step1['visaType'] ?? $main['visaType'] ?? '');
        $residence = mb_strtolower(trim((string) ($main['countryOfResidence'] ?? '')));
        $livesInCanada = $residence !== '' && (
            $residence === 'canada'
            || str_contains($residence, 'canada')
        );

        return [
            'pathway' => $caseFile->immigration_pathway,
            'visa_type' => $visaType,
            'studied_in_canada' => $studiedCanada,
            'canadian_work' => $canadianWork,
            'likely_in_canada' => $studiedCanada || $canadianWork || $livesInCanada,
            'country_of_residence' => $main['countryOfResidence'] ?? null,
        ];
    }

    /**
     * @return list<array{id: int, label: string, level: int}>
     */
    private function breadcrumbPath(IrccCategory $leaf): array
    {
        $path = [];
        $node = $leaf;
        $guard = 0;
        while ($node && $guard < 6) {
            array_unshift($path, [
                'id'    => $node->id,
                'label' => (string) $node->label,
                'level' => (int) $node->level,
            ]);
            $node = $node->parent_id ? IrccCategory::find($node->parent_id) : null;
            $guard++;
        }

        return $path;
    }

    /**
     * @return array{category: null, path: list<never>, source: 'none', reason: string, confidence: 'low'}
     */
    private function empty(string $reason): array
    {
        return [
            'category'   => null,
            'path'       => [],
            'source'     => 'none',
            'reason'     => $reason,
            'confidence' => 'low',
        ];
    }

    private function openAiAvailable(): bool
    {
        return (bool) config('workspace_ai.enabled')
            && (bool) config('services.openai.key');
    }
}

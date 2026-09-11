<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\PathwayNode;
use App\Models\QuestionnaireSubmission;
use Illuminate\Support\Facades\Schema;

class PathwayCatalogService
{
    /** @var array<string, string> legacy display label → code */
    public const LEGACY_LABEL_TO_CODE = [
        'Express Entry – Federal Skilled Worker' => 'ee.fsw',
        'Express Entry – Canadian Experience Class' => 'ee.cec',
        'Express Entry – Federal Skilled Trades' => 'ee.fst',
        'Provincial Nominee Program' => 'pnp',
        'Study Permit' => 'study',
        'Work Permit' => 'work',
        'Family Sponsorship' => 'family.spouse',
    ];

    private function tableReady(): bool
    {
        try {
            return Schema::connection((new PathwayNode)->getConnectionName())->hasTable('pathway_nodes');
        } catch (\Throwable) {
            return false;
        }
    }

    /** @return list<array<string, mixed>> */
    public function tree(): array
    {
        if (! $this->tableReady()) {
            return [];
        }

        $nodes = PathwayNode::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('label')
            ->get()
            ->keyBy('code');

        $childrenMap = [];
        foreach ($nodes as $node) {
            $parent = $node->parent_code ?: '__root__';
            $childrenMap[$parent][] = $node;
        }

        $build = function (?string $parentCode) use (&$build, $childrenMap): array {
            $key = $parentCode ?: '__root__';
            $list = $childrenMap[$key] ?? [];

            return array_map(function (PathwayNode $node) use ($build) {
                return $this->serializeNode($node, $build($node->code));
            }, $list);
        };

        return $build(null);
    }

    /** @return list<array<string, mixed>> */
    public function popular(int $limit = 16): array
    {
        if (! $this->tableReady()) {
            return [];
        }

        return PathwayNode::query()
            ->where('is_active', true)
            ->where('is_assignable', true)
            ->where('is_popular', true)
            ->orderBy('sort_order')
            ->limit($limit)
            ->get()
            ->map(fn (PathwayNode $n) => $this->serializeNode($n))
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function suggestForQuestionnaire(?QuestionnaireSubmission $submission, int $limit = 8): array
    {
        $popular = collect($this->popular(20));
        if (! $submission) {
            return $popular->take($limit)->values()->all();
        }

        $main = is_array($submission->main_data) ? $submission->main_data : [];
        $step1 = is_array($submission->step1_data) ? $submission->step1_data : [];

        $boosted = [];

        $canadianWork = strtolower((string) ($main['canadianWork'] ?? '')) === 'yes';
        $studiedCanada = strtolower((string) ($main['studiedInCanada'] ?? '')) === 'yes';
        $nomination = strtolower((string) ($main['provincialNomination'] ?? '')) === 'yes'
            || strtolower((string) ($main['provincialNominationInterest'] ?? '')) === 'yes';
        $married = strtolower((string) ($step1['married'] ?? '')) === 'yes';
        $visaType = strtolower((string) ($step1['visaType'] ?? ''));
        $trade = strtolower((string) ($main['tradeCertificate'] ?? '')) === 'yes';
        $residence = mb_strtolower((string) ($main['countryOfResidence'] ?? ''));

        if ($canadianWork || $studiedCanada) {
            $boosted[] = 'ee.cec';
        }
        if ($trade) {
            $boosted[] = 'ee.fst';
        }
        if (! $canadianWork) {
            $boosted[] = 'ee.fsw';
        }
        if ($nomination) {
            $boosted[] = 'pnp.on';
            $boosted[] = 'pnp';
        }
        if ($married || str_contains($visaType, 'sponsor') || str_contains($visaType, 'family')) {
            $boosted[] = 'family.spouse';
        }
        if (str_contains($visaType, 'study') || str_contains($visaType, 'temporary') && str_contains($residence, 'sri')) {
            $boosted[] = 'study';
        }
        if (str_contains($visaType, 'work')) {
            $boosted[] = 'work';
        }
        if (str_contains($residence, 'quebec') || str_contains($residence, 'québec') || str_contains($residence, 'qc')) {
            $boosted[] = 'quebec.pstq';
            $boosted[] = 'quebec.peq';
        }
        if (str_contains($visaType, 'business') || str_contains($visaType, 'startup') || str_contains($visaType, 'start-up')) {
            $boosted[] = 'business.startup';
        }
        if (str_contains($visaType, 'visitor') || str_contains($visaType, 'tourist') || str_contains($visaType, 'super')) {
            $boosted[] = str_contains($visaType, 'super') ? 'visitor.super' : 'visitor';
        }

        $ranked = [];
        foreach (array_unique($boosted) as $code) {
            $node = PathwayNode::query()->where('code', $code)->where('is_active', true)->where('is_assignable', true)->first();
            if ($node) {
                $ranked[] = $this->serializeNode($node, [], 'questionnaire');
            }
        }

        foreach ($popular as $item) {
            if (! collect($ranked)->contains(fn ($r) => ($r['code'] ?? '') === ($item['code'] ?? ''))) {
                $ranked[] = $item;
            }
        }

        return array_slice($ranked, 0, $limit);
    }

    public function findByCode(?string $code): ?PathwayNode
    {
        if (! $code || ! $this->tableReady()) {
            return null;
        }

        return PathwayNode::query()->where('code', $code)->where('is_active', true)->first();
    }

    public function findByLabel(?string $label): ?PathwayNode
    {
        if (! is_string($label) || trim($label) === '' || ! $this->tableReady()) {
            return null;
        }

        $trimmed = trim($label);
        if (isset(self::LEGACY_LABEL_TO_CODE[$trimmed])) {
            return $this->findByCode(self::LEGACY_LABEL_TO_CODE[$trimmed]);
        }

        $exact = PathwayNode::query()->where('label', $trimmed)->where('is_active', true)->first();
        if ($exact) {
            return $exact;
        }

        // Soft match: label contains / contained by
        return PathwayNode::query()
            ->where('is_active', true)
            ->where('is_assignable', true)
            ->get()
            ->first(function (PathwayNode $node) use ($trimmed) {
                return strcasecmp($node->label, $trimmed) === 0
                    || str_contains(mb_strtolower($node->label), mb_strtolower($trimmed))
                    || str_contains(mb_strtolower($trimmed), mb_strtolower($node->label));
            });
    }

    /**
     * Resolve from pathway_code and/or immigration_pathway label.
     *
     * @return array{node: ?PathwayNode, code: ?string, label: ?string}
     */
    public function resolve(?string $code, ?string $label): array
    {
        $node = $this->findByCode($code);
        if (! $node && $label) {
            $node = $this->findByLabel($label);
        }

        if ($node) {
            $assignable = $node;
            if (! $node->is_assignable) {
                // Prefer first popular assignable child
                $child = PathwayNode::query()
                    ->where('parent_code', $node->code)
                    ->where('is_active', true)
                    ->where('is_assignable', true)
                    ->orderByDesc('is_popular')
                    ->orderBy('sort_order')
                    ->first();
                $assignable = $child ?? $node;
            }

            return [
                'node' => $assignable,
                'code' => $assignable->code,
                'label' => $assignable->label,
            ];
        }

        return [
            'node' => null,
            'code' => $code,
            'label' => $label,
        ];
    }

    public function packagePreferencesFor(?PathwayNode $node, ?string $pathwayLabel = null): array
    {
        if ($node && is_array($node->package_leaf_preferences) && $node->package_leaf_preferences !== []) {
            return $node->package_leaf_preferences;
        }

        return [];
    }

    public function hubFamilyForCase(CaseFile $caseFile): ?string
    {
        if ($caseFile->pathway_code) {
            $node = $this->findByCode($caseFile->pathway_code);
            if ($node) {
                return $node->hubFamilyLabel();
            }
        }

        return CaseManagementHubService::pathwayFamily($caseFile->immigration_pathway);
    }

    /**
     * Backfill pathway_code on case + profile from legacy label when missing.
     */
    public function backfillCodeIfNeeded(CaseFile $caseFile): CaseFile
    {
        if ($caseFile->pathway_code || ! $caseFile->immigration_pathway) {
            return $caseFile;
        }

        $resolved = $this->resolve(null, $caseFile->immigration_pathway);
        if (! ($resolved['code'] ?? null)) {
            return $caseFile;
        }

        $caseFile->update(['pathway_code' => $resolved['code']]);
        $profile = $caseFile->clientProfile;
        if ($profile && ! $profile->pathway_code) {
            $profile->update([
                'pathway_code' => $resolved['code'],
                'immigration_pathway' => $profile->immigration_pathway ?: $resolved['label'],
            ]);
        }

        return $caseFile->fresh();
    }

    /**
     * @param  list<array<string, mixed>>  $children
     * @return array<string, mixed>
     */
    private function serializeNode(PathwayNode $node, array $children = [], ?string $source = null): array
    {
        return [
            'code' => $node->code,
            'parent_code' => $node->parent_code,
            'label' => $node->label,
            'family' => $node->family,
            'hub_family' => $node->hubFamilyLabel(),
            'assessment_branch' => $node->assessment_branch,
            'province_code' => $node->province_code,
            'community_code' => $node->community_code,
            'crs_backend_value' => $node->crs_backend_value,
            'retainer_fee' => $node->retainer_fee,
            'retainer_description' => $node->retainer_description,
            'package_leaf_preferences' => $node->package_leaf_preferences ?? [],
            'is_assignable' => (bool) $node->is_assignable,
            'is_popular' => (bool) $node->is_popular,
            'sort_order' => (int) $node->sort_order,
            'source' => $source,
            'children' => $children,
        ];
    }
}

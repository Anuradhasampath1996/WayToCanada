<?php

namespace App\Services;

use App\Models\LegislationDocument;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class LegislationHubListService
{
    public function __construct(
        private LegislationSyncService $sync,
    ) {}

    /** @return array<string, array{label: string, description: string, act_codes: array<int, string>}> */
    public function pathwayDefinitions(): array
    {
        return config('legislation_pathways.pathways', []);
    }

    /** @return array<int, string>|null */
    public function actCodesForPathway(?string $slug): ?array
    {
        if ($slug === null || $slug === '') {
            return null;
        }

        $cfg = config("legislation_pathways.pathways.{$slug}");
        if (! is_array($cfg)) {
            return null;
        }

        return array_values(array_unique($cfg['act_codes'] ?? []));
    }

    /** @return array<int, array<string, mixed>> */
    public function pathwayFacets(): array
    {
        $syncedCodes = LegislationDocument::query()
            ->whereNotNull('act_code')
            ->distinct()
            ->pluck('act_code')
            ->all();

        $syncedSet = array_flip($syncedCodes);
        $out       = [];

        foreach ($this->pathwayDefinitions() as $slug => $cfg) {
            $codes = $cfg['act_codes'] ?? [];
            $match = array_values(array_filter($codes, fn (string $c) => isset($syncedSet[$c])));

            $out[] = [
                'slug'            => $slug,
                'label'           => $cfg['label'] ?? $slug,
                'description'     => $cfg['description'] ?? '',
                'act_codes'       => $codes,
                'synced_act_count'=> count($match),
            ];
        }

        return $out;
    }

    /** @return array<int, string> */
    public function priorityActCodes(): array
    {
        $codes = ['I-2.5', 'SOR-2002-227', 'DORS-2002-227'];

        foreach (array_keys(config('legislation_sources.sources', [])) as $slug) {
            $cfg = config("legislation_sources.sources.{$slug}");
            if (! empty($cfg['act_code'])) {
                $codes[] = $cfg['act_code'];
            }
        }

        foreach (config('legislation_sources.immigration_tier', []) as $row) {
            if (! empty($row['act_code'])) {
                $codes[] = $row['act_code'];
            }
        }

        return array_values(array_unique($codes));
    }

    /** @return array<string, mixed> */
    public function listHub(Request $request): array
    {
        $page    = max(1, (int) $request->input('page', 1));
        $perPage = min(50, max(5, (int) $request->input('per_page', 20)));

        $docs   = $this->filteredDocumentsQuery($request)->get();
        $groups = $this->groupDocuments($docs);
        $codes  = $this->priorityActCodes();

        $hasNarrowFilters = $request->filled('q')
            || $request->filled('act_code')
            || $request->filled('pathway');

        $activePathway = $request->filled('pathway') ? (string) $request->string('pathway') : null;
        $pathwayMeta   = $activePathway
            ? (config("legislation_pathways.pathways.{$activePathway}") ?? null)
            : null;

        $featured = [];
        $rest     = [];

        foreach ($groups as $group) {
            $actKey = $group['act_code'] ?? $group['source_slug'];
            if (in_array($actKey, $codes, true)) {
                $group['is_featured']    = true;
                $group['priority_rank']  = array_search($actKey, $codes, true);
                $featured[]              = $group;
            } else {
                $group['is_featured'] = false;
                $rest[]               = $group;
            }
        }

        $sortFeatured = static function (array $a, array $b): int {
            $rank = ($a['priority_rank'] ?? 999) <=> ($b['priority_rank'] ?? 999);
            if ($rank !== 0) {
                return $rank;
            }

            return strcasecmp($a['title'], $b['title']);
        };

        $sortAlpha = static fn (array $a, array $b): int => strcasecmp($a['title'], $b['title']);

        usort($featured, $sortFeatured);

        if ($hasNarrowFilters) {
            usort($groups, function (array $a, array $b) use ($sortFeatured, $sortAlpha): int {
                $aPri = $a['is_featured'] ?? false;
                $bPri = $b['is_featured'] ?? false;
                if ($aPri !== $bPri) {
                    return $aPri ? -1 : 1;
                }
                if ($aPri && $bPri) {
                    return $sortFeatured($a, $b);
                }

                return $sortAlpha($a, $b);
            });

            $total  = count($groups);
            $paged  = array_slice($groups, ($page - 1) * $perPage, $perPage);
            $featured = [];
        } else {
            usort($rest, $sortAlpha);
            $total = count($rest);
            $paged = array_slice($rest, ($page - 1) * $perPage, $perPage);
        }

        return [
            'featured' => $featured,
            'data'     => $paged,
            'meta'     => [
                'current_page' => $page,
                'last_page'    => max(1, (int) ceil($total / $perPage)),
                'per_page'     => $perPage,
                'total'        => $total,
                'total_groups' => count($groups),
            ],
            'facets' => [
                'act_codes' => LegislationDocument::query()
                    ->whereNotNull('act_code')
                    ->distinct()
                    ->orderBy('act_code')
                    ->pluck('act_code')
                    ->values()
                    ->all(),
                'pathways' => $this->pathwayFacets(),
            ],
            'pathway'        => $activePathway ? [
                'slug'        => $activePathway,
                'label'       => $pathwayMeta['label'] ?? $activePathway,
                'description' => $pathwayMeta['description'] ?? '',
            ] : null,
            'priority_codes' => $codes,
        ];
    }

    private function filteredDocumentsQuery(Request $request): Builder
    {
        $query = LegislationDocument::query()
            ->orderBy('title')
            ->orderBy('language')
            ->orderBy('format');

        if ($request->filled('language')) {
            $query->where('language', $request->string('language'));
        }
        if ($request->filled('format')) {
            $query->where('format', $request->string('format'));
        }
        if ($request->filled('act_code')) {
            $query->where('act_code', $request->string('act_code'));
        }
        if ($request->filled('category')) {
            $query->where('category', $request->string('category'));
        }
        if ($request->filled('pathway')) {
            $codes = $this->actCodesForPathway((string) $request->string('pathway'));
            if ($codes === null || $codes === []) {
                $query->whereRaw('0 = 1');
            } else {
                $query->whereIn('act_code', $codes);
            }
        }
        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(function ($q) use ($term) {
                $q->where('title', 'like', $term)
                    ->orWhere('act_code', 'like', $term)
                    ->orWhere('source_slug', 'like', $term);
            });
        }

        return $query;
    }

    /**
     * @param  Collection<int, LegislationDocument>  $docs
     * @return array<int, array<string, mixed>>
     */
    private function groupDocuments(Collection $docs): array
    {
        /** @var array<string, array<string, mixed>> $map */
        $map = [];

        foreach ($docs as $doc) {
            $key      = ($doc->act_code ?? $doc->source_slug).'::'.$doc->language;
            $fmt      = $doc->format;
            $formatted = $this->sync->formatDocument($doc);

            if (! isset($map[$key])) {
                $map[$key] = [
                    'key'               => $key,
                    'title'             => preg_replace('/\s*\(XML\)|\s*\(HTML\)|\s*\(PDF\)/i', '', $doc->title) ?: $doc->title,
                    'act_code'          => $doc->act_code,
                    'source_slug'       => $doc->source_slug,
                    'language'          => $doc->language,
                    'category'          => $doc->category,
                    'provisions_count'  => $doc->provisions_count,
                    'last_synced_at'    => $doc->last_synced_at?->toIso8601String(),
                    'formats'           => [$fmt => $formatted],
                    'has_smart_popups'  => $doc->format === 'xml' && ! empty($doc->rendered_html),
                    'is_featured'       => false,
                ];
                continue;
            }

            $map[$key]['formats'][$fmt] = $formatted;
            $map[$key]['provisions_count'] = max($map[$key]['provisions_count'], $doc->provisions_count);
            if ($doc->format === 'xml' && ! empty($doc->rendered_html)) {
                $map[$key]['has_smart_popups'] = true;
            }
            $synced = $doc->last_synced_at?->toIso8601String();
            if ($synced && (! $map[$key]['last_synced_at'] || $synced > $map[$key]['last_synced_at'])) {
                $map[$key]['last_synced_at'] = $synced;
            }
        }

        return array_values($map);
    }
}

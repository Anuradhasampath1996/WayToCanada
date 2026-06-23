<?php

namespace App\Services;

use App\Models\ExpressEntryDraw;

class WorkspaceMapleImmigrationKnowledgeService
{
    public function __construct(
        private CrsRulesService $crsRules,
        private LegislationProvisionSearchService $legislationSearch,
        private LegislationHubLinkService $hubLinks,
    ) {}

    /** @return array<string, mixed> */
    public function packForQuestion(string $message): array
    {
        $topics = config('maple_immigration_topics', []);
        $q      = strtolower($message);
        $excerpts = $this->searchLegislation($message);

        return [
            'crs_rules' => [
                'meta'     => $this->crsRules->meta(),
                'policies' => $this->crsRules->activeRules()['policies'] ?? [],
                'notes'    => $this->pickTopicLines($topics['crs_notes'] ?? [], $q),
            ],
            'express_entry_draws' => $this->recentDraws($q),
            'pathway_guides'      => $this->pickTopicMap($topics['pathways'] ?? [], $q),
            'admissibility_guides'=> $this->pickTopicMap($topics['admissibility'] ?? [], $q),
            'legislation_excerpts'=> $excerpts,
            'legislation_links'   => $this->hubLinks->enrichRows($excerpts),
        ];
    }

    /**
     * @param  array<string, mixed>  $immigrationKnowledge
     * @return list<array<string, mixed>>
     */
    public function citationLinksForResponse(array $immigrationKnowledge): array
    {
        $links = $immigrationKnowledge['legislation_links'] ?? [];

        return array_values(array_filter($links, fn ($l) => ! empty($l['hub_path'])));
    }

    /** @return list<array<string, mixed>> */
    private function recentDraws(string $q): array
    {
        $limit = $this->asksAny($q, ['draw', 'cut', 'crs', 'express', 'invite', 'ita', 'round'])
            ? 8
            : 3;

        return ExpressEntryDraw::orderByDesc('draw_date')
            ->orderByDesc('draw_number')
            ->limit($limit)
            ->get()
            ->map(fn (ExpressEntryDraw $d) => [
                'draw_number'         => $d->draw_number,
                'draw_date'           => optional($d->draw_date)?->format('Y-m-d'),
                'draw_name'           => $d->draw_name,
                'minimum_crs_score'   => $d->minimum_crs_score,
                'invitations_issued'  => $d->invitations_issued,
                'round_type'          => $d->round_type,
            ])
            ->all();
    }

    /**
     * @param  array<string, string>  $map
     * @return array<string, string>
     */
    private function pickTopicMap(array $map, string $q): array
    {
        if ($map === []) {
            return [];
        }

        $picked = [];
        foreach ($map as $key => $text) {
            if ($this->topicMatches($key, $q)) {
                $picked[$key] = $text;
            }
        }

        if ($picked !== []) {
            return $picked;
        }

        if ($this->asksAny($q, ['pathway', 'route', 'program', 'immigrat', 'pr ', 'permanent'])) {
            return array_slice($map, 0, 3, true);
        }

        if ($this->asksAny($q, ['inadmiss', 'criminal', 'medical', 'refusal', 'misrepresent'])) {
            return $map;
        }

        return [];
    }

    /** @param  list<string>  $lines */
    private function pickTopicLines(array $lines, string $q): array
    {
        if ($this->asksAny($q, ['crs', 'point', 'score', 'clb', 'ielts', 'french', 'pnp', 'nomination'])) {
            return $lines;
        }

        return [];
    }

    /** @return list<array<string, mixed>> */
    private function searchLegislation(string $message): array
    {
        if (strlen(trim($message)) < 3) {
            return [];
        }

        $payload = $this->legislationSearch->search($message, 'en', 6, true);

        return array_map(fn (array $row) => [
            'act_code'       => $row['act_code'],
            'provision_key'  => $row['provision_key'],
            'section_label'  => $row['section_label'],
            'marginal_note'  => $row['marginal_note'],
            'excerpt'        => $row['excerpt'],
            'viewer_document_id' => $row['viewer_document_id'] ?? null,
        ], $payload['results'] ?? []);
    }

    private function topicMatches(string $key, string $q): bool
    {
        $key = str_replace('_', ' ', $key);

        return str_contains($q, $key) || str_contains($q, str_replace(' ', '', $key));
    }

    /** @param  list<string>  $needles */
    private function asksAny(string $q, array $needles): bool
    {
        foreach ($needles as $needle) {
            if (str_contains($q, $needle)) {
                return true;
            }
        }

        return false;
    }
}

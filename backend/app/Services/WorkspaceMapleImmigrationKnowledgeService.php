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
        $excerpts = $this->wantsLegislationSearch($message)
            ? $this->searchLegislation($message)
            : [];

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
            'legislation_links'   => $excerpts === [] ? [] : $this->hubLinks->enrichRows($excerpts),
        ];
    }

    /**
     * Only return hub chips Maple actually used in the reply.
     * Never dump a broad search result list under every answer.
     *
     * @param  array<string, mixed>  $immigrationKnowledge
     * @return list<array<string, mixed>>
     */
    public function citationLinksForResponse(array $immigrationKnowledge, ?string $reply = null): array
    {
        $links = $immigrationKnowledge['legislation_links'] ?? [];
        $links = array_values(array_filter($links, fn ($l) => ! empty($l['hub_path'])));

        if ($links === [] || $reply === null || trim($reply) === '') {
            return [];
        }

        $cited = [];
        foreach ($links as $link) {
            if ($this->replyCitesLink($reply, $link)) {
                $cited[] = $link;
            }
        }

        return array_slice($cited, 0, 4);
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

    /**
     * Gate legislation retrieval so casual case chat (esp. romanized Sinhala)
     * does not match random IRPA substrings like "oni" / "mata".
     */
    private function wantsLegislationSearch(string $message): bool
    {
        $q = strtolower(trim($message));
        if ($q === '') {
            return false;
        }

        if (preg_match('/\b(s|sec|section)\s*\.?\s*\d+/i', $message)) {
            return true;
        }

        if (preg_match('/\b(a|r)-\s*\d+\b/i', $message)) {
            return true;
        }

        return $this->asksAny($q, [
            'legislation', 'regulation', 'statute', 'irpa', 'irpr',
            'inadmiss', 'criminality', 'misrepresent', 'residency obligation',
            'study permit', 'work permit', 'visitor visa', 'temporary resident',
            'permanent resident', 'pr card', 'citizenship', 'refugee',
            'deport', 'removal order', 'detention', 'appeal', 'sponsor',
            'express entry', 'provincial nominee', 'pnp', 'lmia',
            'section ', 'niyamaya', 'niyama', 'act eka', 'regulation eka',
        ]);
    }

    /** @param  array<string, mixed>  $link */
    private function replyCitesLink(string $reply, array $link): bool
    {
        $hay = mb_strtolower($reply);

        $section = trim((string) ($link['section_label'] ?? ''));
        if ($section !== '') {
            $escaped = preg_quote($section, '/');
            if (preg_match('/\b(?:section|s\.?|sec\.?)\s*'.$escaped.'\b/iu', $reply)) {
                return true;
            }
            if (preg_match('/\b'.$escaped.'\b/u', $reply) && str_contains($hay, 'section')) {
                return true;
            }
        }

        $key = trim((string) ($link['provision_key'] ?? ''));
        if ($key !== '' && str_contains($hay, mb_strtolower($key))) {
            return true;
        }

        $citation = trim((string) ($link['citation'] ?? ''));
        if ($citation !== '' && str_contains($hay, mb_strtolower($citation))) {
            return true;
        }

        $act = trim((string) ($link['act_code'] ?? ''));
        if ($act !== '' && $section !== '') {
            $combo = mb_strtolower($act.' '.$section);
            if (str_contains($hay, $combo) || str_contains($hay, mb_strtolower($act.' — section '.$section))) {
                return true;
            }
        }

        return false;
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

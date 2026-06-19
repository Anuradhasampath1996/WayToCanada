<?php

namespace App\Services;

use App\Models\ExpressEntryDraw;
use App\Models\LegislationProvision;

class WorkspaceMapleImmigrationKnowledgeService
{
    public function __construct(private CrsRulesService $crsRules) {}

    /** @return array<string, mixed> */
    public function packForQuestion(string $message): array
    {
        $topics = config('maple_immigration_topics', []);
        $q      = strtolower($message);

        return [
            'crs_rules' => [
                'meta'     => $this->crsRules->meta(),
                'policies' => $this->crsRules->activeRules()['policies'] ?? [],
                'notes'    => $this->pickTopicLines($topics['crs_notes'] ?? [], $q),
            ],
            'express_entry_draws' => $this->recentDraws($q),
            'pathway_guides'      => $this->pickTopicMap($topics['pathways'] ?? [], $q),
            'admissibility_guides'=> $this->pickTopicMap($topics['admissibility'] ?? [], $q),
            'legislation_excerpts'=> $this->searchLegislation($message),
        ];
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
        $terms = $this->extractSearchTerms($message);
        if ($terms === []) {
            return [];
        }

        $query = LegislationProvision::query()
            ->where('language', 'en')
            ->where(function ($outer) use ($terms) {
                foreach ($terms as $term) {
                    $like = '%'.$term.'%';
                    $outer->orWhere(function ($q) use ($like) {
                        $q->where('text_content', 'like', $like)
                            ->orWhere('marginal_note', 'like', $like)
                            ->orWhere('section_label', 'like', $like);
                    });
                }
            })
            ->orderBy('act_code')
            ->limit(6);

        return $query->get()->map(fn (LegislationProvision $p) => [
            'act_code'       => $p->act_code,
            'provision_key'  => $p->provision_key,
            'section_label'  => $p->section_label,
            'marginal_note'  => $p->marginal_note,
            'excerpt'        => mb_substr(trim((string) $p->text_content), 0, 500),
        ])->all();
    }

    /** @return list<string> */
    private function extractSearchTerms(string $message): array
    {
        $q = strtolower($message);
        $stop = ['what', 'when', 'where', 'which', 'does', 'this', 'that', 'with', 'from', 'about', 'client', 'case', 'please', 'tell', 'explain'];

        $terms = [];
        foreach (preg_split('/\s+/', $q) ?: [] as $word) {
            $word = preg_replace('/[^a-z0-9\-]/', '', $word) ?? '';
            if (strlen($word) < 4 || in_array($word, $stop, true)) {
                continue;
            }
            $terms[] = $word;
        }

        foreach (['inadmissibility', 'criminal', 'misrepresentation', 'express entry', 'permanent resident', 'study permit', 'work permit', 'provincial nominee'] as $phrase) {
            if (str_contains($q, $phrase)) {
                $terms[] = str_replace(' ', '', $phrase);
            }
        }

        return array_values(array_unique(array_slice($terms, 0, 8)));
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

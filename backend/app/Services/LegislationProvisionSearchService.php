<?php

namespace App\Services;

use App\Models\LegislationDocument;
use App\Models\LegislationProvision;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LegislationProvisionSearchService
{
    private const IMMIGRATION_PHRASES = [
        'study permit'       => ['study', 'permit', 'student', 'designated'],
        'work permit'        => ['work', 'permit', 'employer', 'lmia'],
        'express entry'      => ['express', 'entry', 'invitation', 'comprehensive'],
        'permanent resident' => ['permanent', 'resident', 'residence'],
        'inadmissibility'    => ['inadmissib', 'criminal', 'medical', 'misrepresent'],
        'misrepresentation'  => ['misrepresent', 'false', 'withhold'],
        'refugee'            => ['refugee', 'asylum', 'protection'],
        'sponsor'            => ['sponsor', 'undertaking', 'family class'],
        'provincial nominee' => ['provincial', 'nominee', 'pnp'],
        'detention'          => ['detention', 'detain', 'custody'],
        'appeal'             => ['appeal', 'review', 'rad'],
    ];

    /**
     * @return array{results: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function search(string $query, string $language = 'en', int $limit = 12, bool $useAi = true): array
    {
        $query  = trim($query);
        $limit  = max(1, min($limit, 30));
        $terms  = $this->extractTerms($query);
        $phrases = $this->matchPhrases(strtolower($query));

        if ($terms === [] && $phrases === []) {
            return [
                'results' => [],
                'meta'    => [
                    'query'            => $query,
                    'ai_used'          => false,
                    'openai_available' => $this->openAiAvailable(),
                    'total_candidates' => 0,
                ],
            ];
        }

        $dbQuery = LegislationProvision::query()
            ->with(['document:id,title,format,act_code,language,source_slug'])
            ->where(function ($outer) use ($query, $terms, $phrases) {
                $like = '%'.$query.'%';
                $outer->where('text_content', 'like', $like)
                    ->orWhere('marginal_note', 'like', $like);

                foreach ($terms as $term) {
                    $t = '%'.$term.'%';
                    $outer->orWhere(function ($q) use ($t) {
                        $q->where('text_content', 'like', $t)
                            ->orWhere('marginal_note', 'like', $t)
                            ->orWhere('section_label', 'like', $t)
                            ->orWhere('provision_key', 'like', $t);
                    });
                }

                foreach ($phrases as $phraseTerms) {
                    $outer->orWhere(function ($q) use ($phraseTerms) {
                        foreach ($phraseTerms as $term) {
                            $q->where('text_content', 'like', '%'.$term.'%');
                        }
                    });
                }
            });

        if ($language !== 'all') {
            $dbQuery->where('language', $language);
        }

        $candidates = $dbQuery
            ->orderBy('act_code')
            ->limit(80)
            ->get()
            ->map(fn (LegislationProvision $p) => $this->scoreProvision($p, $query, $terms, $phrases))
            ->filter(fn (array $row) => ($row['score'] ?? 0) > 0)
            ->sortByDesc('score')
            ->values()
            ->take(25)
            ->all();

        $aiUsed = false;
        if ($useAi && $this->openAiAvailable() && count($candidates) > 1) {
            $reranked = $this->rerankWithOpenAi($query, $candidates);
            if ($reranked !== null) {
                $candidates = $reranked;
                $aiUsed     = true;
            }
        }

        $results   = array_slice($candidates, 0, $limit);
        $viewerIds = $this->resolveViewerDocumentIds($results);

        $results = array_map(function (array $row) use ($viewerIds) {
            $lang = (string) ($row['language'] ?? 'en');
            $act  = (string) ($row['act_code'] ?? '');
            $key  = $act.'::'.$lang;

            return [
                'provision_id'       => $row['provision_id'],
                'act_code'           => $row['act_code'],
                'provision_key'      => $row['provision_key'],
                'citation'           => $row['citation'],
                'section_label'      => $row['section_label'],
                'marginal_note'      => $row['marginal_note'],
                'excerpt'            => $row['excerpt'],
                'score'              => $row['score'],
                'language'           => $lang,
                'document_title'     => $row['document_title'],
                'viewer_document_id' => $viewerIds[$key] ?? $row['document_id'],
            ];
        }, $results);

        return [
            'results' => $results,
            'meta'    => [
                'query'            => $query,
                'ai_used'          => $aiUsed,
                'openai_available' => $this->openAiAvailable(),
                'total_candidates' => count($candidates),
            ],
        ];
    }

    /**
     * @param  list<string>  $terms
     * @param  list<list<string>>  $phrases
     * @return array<string, mixed>
     */
    private function scoreProvision(
        LegislationProvision $p,
        string $query,
        array $terms,
        array $phrases,
    ): array {
        $text     = strtolower((string) $p->text_content);
        $marginal = strtolower((string) ($p->marginal_note ?? ''));
        $haystack = $text.' '.$marginal;
        $score    = 0;

        if (str_contains($haystack, strtolower($query))) {
            $score += 12;
        }

        foreach ($terms as $term) {
            if (str_contains($haystack, $term)) {
                $score += 3;
            }
            if (str_contains(strtolower((string) $p->provision_key), $term)) {
                $score += 4;
            }
            if (str_contains(strtolower((string) ($p->section_label ?? '')), $term)) {
                $score += 2;
            }
        }

        foreach ($phrases as $phraseTerms) {
            $all = true;
            foreach ($phraseTerms as $term) {
                if (! str_contains($haystack, $term)) {
                    $all = false;
                    break;
                }
            }
            if ($all) {
                $score += 8;
            }
        }

        $excerpt = trim((string) $p->text_content);
        if (strlen($excerpt) > 320) {
            $excerpt = mb_substr($excerpt, 0, 320).'…';
        }

        $sectionPart = $p->section_label ? 'Section '.$p->section_label : '';
        $keyPart       = $p->provision_key ? ' ('.$p->provision_key.')' : '';

        return [
            'provision_id'   => $p->id,
            'document_id'    => $p->document_id,
            'act_code'       => $p->act_code,
            'provision_key'  => $p->provision_key,
            'section_label'  => $p->section_label,
            'marginal_note'  => $p->marginal_note,
            'language'       => $p->language,
            'document_title' => $p->document?->title,
            'citation'       => trim($p->act_code.' — '.$sectionPart.$keyPart),
            'excerpt'        => $excerpt,
            'score'          => $score,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $candidates
     * @return list<array<string, mixed>>|null
     */
    private function rerankWithOpenAi(string $query, array $candidates): ?array
    {
        $lines = [];
        foreach (array_slice($candidates, 0, 20) as $i => $row) {
            $lines[] = sprintf(
                '%d. %s | %s',
                $i,
                $row['citation'] ?? '',
                mb_substr((string) ($row['excerpt'] ?? ''), 0, 180),
            );
        }

        try {
            $response = Http::withToken((string) config('services.openai.key'))
                ->timeout(45)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model'       => config('legislation_sources.openai.model', 'gpt-4o-mini'),
                    'temperature' => 0.1,
                    'max_tokens'  => 200,
                    'messages'    => [
                        [
                            'role'    => 'system',
                            'content' => 'You rank Canadian immigration legislation provisions by relevance to a consultant search query. Reply ONLY with a JSON array of integer indices in best-first order, e.g. [2,0,5,1]. No other text.',
                        ],
                        [
                            'role'    => 'user',
                            'content' => "Query: {$query}\n\nProvisions:\n".implode("\n", $lines),
                        ],
                    ],
                ]);

            if ($response->failed()) {
                Log::warning('[Legislation search] OpenAI rerank failed', ['status' => $response->status()]);

                return null;
            }

            $content = trim((string) ($response->json('choices.0.message.content') ?? ''));
            $content = preg_replace('/^```json\s*|\s*```$/', '', $content) ?? $content;
            $indices = json_decode($content, true);
            if (! is_array($indices)) {
                return null;
            }

            $slice   = array_slice($candidates, 0, 20);
            $ordered = [];
            foreach ($indices as $idx) {
                if (! is_int($idx) && ! is_numeric($idx)) {
                    continue;
                }
                $idx = (int) $idx;
                if (isset($slice[$idx]) && ! in_array($slice[$idx]['provision_id'], array_column($ordered, 'provision_id'), true)) {
                    $ordered[] = $slice[$idx];
                }
            }

            foreach ($slice as $row) {
                if (! in_array($row['provision_id'], array_column($ordered, 'provision_id'), true)) {
                    $ordered[] = $row;
                }
            }

            return array_merge($ordered, array_slice($candidates, 20));
        } catch (\Throwable $e) {
            Log::warning('[Legislation search] OpenAI rerank error: '.$e->getMessage());

            return null;
        }
    }

    /**
     * @param  list<array<string, mixed>>  $results
     * @return array<string, int>
     */
    private function resolveViewerDocumentIds(array $results): array
    {
        $acts = collect($results)->pluck('act_code')->filter()->unique()->values()->all();
        if ($acts === []) {
            return [];
        }

        $docs = LegislationDocument::query()
            ->whereIn('act_code', $acts)
            ->where('format', 'xml')
            ->whereNotNull('rendered_html')
            ->get(['id', 'act_code', 'language']);

        $map = [];
        foreach ($docs as $doc) {
            $map[$doc->act_code.'::'.$doc->language] = $doc->id;
        }

        return $map;
    }

    /** @return list<string> */
    private function extractTerms(string $message): array
    {
        $q = strtolower($message);
        $stop = ['what', 'when', 'where', 'which', 'does', 'this', 'that', 'with', 'from', 'about', 'please', 'tell', 'explain', 'section', 'find', 'show'];

        $terms = [];
        foreach (preg_split('/\s+/u', $q) ?: [] as $word) {
            $word = preg_replace('/[^a-z0-9\-]/u', '', $word) ?? '';
            if (strlen($word) < 3 || in_array($word, $stop, true)) {
                continue;
            }
            $terms[] = $word;
        }

        return array_values(array_unique(array_slice($terms, 0, 10)));
    }

    /** @return list<list<string>> */
    private function matchPhrases(string $q): array
    {
        $matched = [];
        foreach (self::IMMIGRATION_PHRASES as $phrase => $terms) {
            if (str_contains($q, $phrase)) {
                $matched[] = $terms;
            }
        }

        return $matched;
    }

    public function openAiAvailable(): bool
    {
        $key = (string) config('services.openai.key');

        return (bool) config('legislation_sources.openai.enabled')
            && $key !== ''
            && ! str_starts_with($key, 'sk-test');
    }
}

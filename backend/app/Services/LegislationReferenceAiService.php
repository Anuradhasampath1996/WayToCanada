<?php

namespace App\Services;

use App\Models\LegislationDocument;
use App\Models\LegislationReference;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LegislationReferenceAiService
{
    private const DETECT_PATTERN = '/\b(?:subsections?\s+\([\d.]+\)(?:\s+(?:to|or)\s+\([\d.]+\))+|\b(?:subsections?|sections?|paragraphs?)\s+\d+(?:\.\d+)?(?:\([^)]+\))*(?:\s+of\s+the\s+Act)?|\d+(?:\.\d+)?(?:\([^)]+\))*\s+of\s+the\s+Act|subsections\s+\d+(?:\.\d+)?\([\d.]+\)(?:\s+and\s+\d+(?:\.\d+)?\([\d.]+\))*)/iu';

    public function __construct(
        private LegislationReferenceLabelParser $labelParser,
        private LegislationSyncService $sync,
        private LegislationReferenceRenderService $render,
    ) {}

    /**
     * Detect unlinked reference patterns, cache in DB, optionally use OpenAI, linkify HTML.
     *
     * @param  callable(array{percent: int, step: string, message: string}): void|null  $onProgress
     * @return array<string, mixed>
     */
    public function analyzeLinkifyAndCache(
        LegislationDocument $document,
        bool $useOpenAi = true,
        ?callable $onProgress = null,
    ): array {
        if ($document->format !== 'xml' || empty($document->storage_path)) {
            return [
                'detected'       => 0,
                'cached'         => 0,
                'linked'         => 0,
                'expanded'       => 0,
                'unresolved'     => 0,
                'already_linked' => 0,
                'prefix_gaps'    => 0,
                'openai_used'    => false,
                'skipped'        => true,
            ];
        }

        $this->reportProgress($onProgress, 5, 'parse', 'Loading XML source…');
        $baseHtml      = $this->render->freshBaseHtml($document);
        $beforeLinks   = $this->countExistingLinks($document->rendered_html ?? $baseHtml);
        $beforeGaps    = $this->render->countPrefixGaps($document->rendered_html ?? $baseHtml);

        $cached     = 0;
        $unresolved = 0;
        $detected   = 0;

        $this->reportProgress($onProgress, 15, 'prefix_gaps', 'Scanning prefix gaps…');
        $prefixGaps = $this->render->discoverPrefixGapLabels($baseHtml);
        foreach ($prefixGaps as $i => $gap) {
            $detected++;
            if ($this->cacheDirect($document, $gap['label'], $gap['target_act_code'], $gap['target_provision_key'], 'auto_xml')) {
                $cached++;
            }
            if ($prefixGaps !== []) {
                $pct = 15 + (int) (20 * ($i + 1) / count($prefixGaps));
                $this->reportProgress($onProgress, $pct, 'prefix_gaps', 'Caching prefix references…');
            }
        }

        $this->reportProgress($onProgress, 40, 'plain_gaps', 'Scanning plain-text references…');
        $plainGaps = $this->render->findPlainTextGapLabels($baseHtml, $document->language);
        $unlinked  = array_unique(array_merge($this->findUnlinkedLabels($baseHtml), $plainGaps));
        $detected += count($unlinked);

        foreach ($unlinked as $i => $label) {
            $result = $this->cacheLabel($document, $label, 'auto_xml');
            if ($result === 'cached') {
                $cached++;
            } elseif ($result === 'unresolved') {
                $unresolved++;
            }
            if ($unlinked !== []) {
                $pct = 40 + (int) (20 * ($i + 1) / count($unlinked));
                $this->reportProgress($onProgress, min($pct, 59), 'plain_gaps', 'Caching detected phrases…');
            }
        }

        $openaiUsed = false;
        $aiDetected = 0;
        if ($useOpenAi && $this->openAiAvailable()) {
            $openaiUsed = true;
            $this->reportProgress($onProgress, 62, 'openai', 'Running OpenAI analysis…');
            $aiCount    = $this->detectViaOpenAi($document, $baseHtml);
            $cached += $aiCount['cached'];
            $unresolved += $aiCount['unresolved'];
            $aiDetected = $aiCount['detected'];
            $detected += $aiDetected;
            $this->reportProgress($onProgress, 78, 'openai', 'OpenAI analysis complete.');
        }

        $this->reportProgress($onProgress, 85, 'linkify', 'Applying verified links to document…');
        $finalize   = $this->render->finalizeDocument($document, $baseHtml);
        $rendered   = $finalize['html'];
        $afterLinks = $this->countExistingLinks($rendered);
        $afterGaps  = $this->render->countPrefixGaps($rendered);

        $document->update([
            'rendered_html' => $rendered,
            'ai_analyzed'   => true,
        ]);

        $this->reportProgress($onProgress, 100, 'done', 'Analysis complete.');

        return [
            'detected'            => $detected,
            'cached'              => $cached,
            'linked'              => max($afterLinks - $beforeLinks, 0),
            'expanded'            => max($beforeGaps - $afterGaps, 0),
            'unresolved'          => $unresolved,
            'already_linked'      => $beforeLinks,
            'prefix_gaps_before'  => $beforeGaps,
            'prefix_gaps_after'   => $afterGaps,
            'openai_used'         => $openaiUsed,
            'openai_enabled'      => $this->openAiAvailable(),
            'references_count'    => $document->references()->where('is_active', true)->count(),
            'verify_gated'        => $finalize['verify_gated'],
            'stripped_broken'     => $finalize['stripped'],
            'unresolved_detected' => $finalize['unresolved_detected'],
            'unresolved_queued'   => $finalize['unresolved_queued'],
            'pending_queue'       => $document->references()
                ->where('is_active', false)
                ->whereNotNull('target_provision_key')
                ->count(),
        ];
    }

    /** @param  callable(array{percent: int, step: string, message: string}): void|null  $onProgress */
    private function reportProgress(?callable $onProgress, int $percent, string $step, string $message): void
    {
        if ($onProgress) {
            $onProgress([
                'percent' => min(100, max(0, $percent)),
                'step'    => $step,
                'message' => $message,
            ]);
        }
    }

    /** Legacy analyze — cache only, no linkify. */
    public function analyzeDocument(LegislationDocument $document): array
    {
        return $this->analyzeLinkifyAndCache($document, $this->openAiAvailable());
    }

    /** @return array<int, string> */
    public function findUnlinkedLabels(string $html): array
    {
        $linkedTexts = [];
        preg_match_all('/<a[^>]*class="[^"]*leg-ref[^"]*"[^>]*>([^<]*)<\/a>/iu', $html, $linked);
        foreach ($linked[1] as $text) {
            $linkedTexts[mb_strtolower(trim($text))] = true;
        }

        $found = [];
        preg_match_all('/>([^<]+)</u', $html, $nodes);
        foreach ($nodes[1] as $text) {
            if (str_contains($text, 'leg-ref')) {
                continue;
            }
            preg_match_all(self::DETECT_PATTERN, $text, $matches);
            foreach ($matches[0] as $label) {
                $label = trim($label);
                $norm  = mb_strtolower($label);
                if ($label !== '' && ! isset($linkedTexts[$norm]) && ! isset($found[$norm])) {
                    $found[$norm] = $label;
                }
            }
        }

        return array_values($found);
    }

    private function countExistingLinks(string $html): int
    {
        return substr_count($html, 'class="leg-ref');
    }

    private function cacheDirect(
        LegislationDocument $document,
        string $label,
        string $act,
        string $key,
        string $sourceType,
    ): bool {
        if (! $this->sync->resolveReference($act, $key, $document->language)) {
            return false;
        }

        LegislationReference::updateOrCreate(
            [
                'document_id' => $document->id,
                'label'       => $label,
                'source_type' => $sourceType,
            ],
            [
                'target_act_code'      => $act,
                'target_provision_key' => $key,
                'is_active'            => true,
            ]
        );

        return true;
    }

    /** @return 'cached'|'unresolved'|'skipped' */
    private function cacheLabel(LegislationDocument $document, string $label, string $sourceType): string
    {
        $parsed = $this->labelParser->parse($label, $document);
        if (! $parsed) {
            return 'unresolved';
        }

        if (! $this->sync->resolveReference(
            $parsed['target_act_code'],
            $parsed['target_provision_key'],
            $document->language,
        )) {
            return 'unresolved';
        }

        LegislationReference::updateOrCreate(
            [
                'document_id' => $document->id,
                'label'       => $label,
                'source_type' => $sourceType,
            ],
            [
                'target_act_code'      => $parsed['target_act_code'],
                'target_provision_key' => $parsed['target_provision_key'],
                'is_active'            => true,
            ]
        );

        return 'cached';
    }

    /** @return array{detected: int, cached: int, unresolved: int} */
    private function detectViaOpenAi(LegislationDocument $document, string $baseHtml): array
    {
        $unlinked   = $this->findUnlinkedLabels($baseHtml);
        $plainGaps  = $this->render->findPlainTextGapLabels($baseHtml, $document->language);
        $prefixGaps = array_column($this->render->discoverPrefixGapLabels($baseHtml), 'label');
        $candidates = array_values(array_unique(array_merge($unlinked, $plainGaps, $prefixGaps)));

        if ($candidates === []) {
            $candidates = $this->extractAiPlainTextSamples($document, $baseHtml);
        }

        if ($candidates === []) {
            return ['detected' => 0, 'cached' => 0, 'unresolved' => 0];
        }

        $sample = implode("\n", array_slice($candidates, 0, 60));
        $parent = config('legislation_sources.regulation_parent_acts', [])[$document->act_code] ?? null;

        try {
            $response = Http::withToken(config('services.openai.key'))
                ->timeout(120)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model'    => config('legislation_sources.openai.model'),
                    'messages' => [
                        [
                            'role'    => 'system',
                            'content' => 'Analyze Canadian legislation cross-references. Return JSON {"references":[{"label":"exact phrase as it appears in text","target_act_code":"'.($parent ?? $document->act_code).' or '.$document->act_code.'","target_provision_key":"e.g. 14.1(1)"}]}. Include full phrases like "subsection 24(1) of the Act", "section 148", "paragraph 38(2)(d)", ranges like "subsections (1) to (2)", lists like "subsections 10.1(3) and 10.2(3)", and decimal subsections like "subsection (1.01)" or "subsection (1.1) or (1.2)" (resolve using surrounding section context when possible). For IRPR references to the Act use act code '.($parent ?? 'I-2.5').'.',
                        ],
                        [
                            'role'    => 'user',
                            'content' => "Document: {$document->act_code} ({$document->title})\nPhrases needing links:\n{$sample}",
                        ],
                    ],
                    'response_format' => ['type' => 'json_object'],
                ]);

            if (! $response->successful()) {
                Log::warning('Legislation OpenAI analysis failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                return ['detected' => count($candidates), 'cached' => 0, 'unresolved' => 0];
            }

            $content = $response->json('choices.0.message.content');
            $parsed  = json_decode($content, true);
            $cached  = 0;
            $unresolved = 0;

            foreach ($parsed['references'] ?? [] as $ref) {
                $label = trim($ref['label'] ?? '');
                if ($label === '') {
                    continue;
                }

                $act = $ref['target_act_code'] ?? $document->act_code;
                $key = $ref['target_provision_key'] ?? '';
                if ($key === '') {
                    $parsedLabel = $this->labelParser->parse($label, $document);
                    if ($parsedLabel) {
                        $act = $parsedLabel['target_act_code'];
                        $key = $parsedLabel['target_provision_key'];
                    }
                }

                if ($key === '' || ! $this->sync->resolveReference($act, $key, $document->language)) {
                    $unresolved++;
                    continue;
                }

                LegislationReference::updateOrCreate(
                    [
                        'document_id' => $document->id,
                        'label'       => $label,
                        'source_type' => 'auto_ai',
                    ],
                    [
                        'target_act_code'      => $act,
                        'target_provision_key' => $key,
                        'is_active'            => true,
                    ]
                );
                $cached++;
            }

            return ['detected' => count($candidates), 'cached' => $cached, 'unresolved' => $unresolved];
        } catch (\Throwable $e) {
            Log::warning('Legislation OpenAI analysis failed: '.$e->getMessage());

            return ['detected' => count($candidates), 'cached' => 0, 'unresolved' => 0];
        }
    }

    /** @return array<int, string> */
    private function extractAiPlainTextSamples(LegislationDocument $document, string $html): array
    {
        $samples = [];
        $plain   = strip_tags(str_replace(['<a ', '</a>'], [' [LINK ', ' [/LINK] '], $html));
        $lines   = preg_split('/\R+/', $plain) ?: [];

        foreach ($lines as $line) {
            $line = trim(preg_replace('/\s+/', ' ', $line) ?? $line);
            if ($line === '') {
                continue;
            }
            if (preg_match('/subsection|section \d|paragraph \d|of the Act|\(\d+\)/i', $line)) {
                $samples[] = mb_substr($line, 0, 240);
            }
            if (count($samples) >= 40) {
                break;
            }
        }

        if ($samples === []) {
            foreach ($document->provisions()->orderBy('provision_key')->limit(80)->cursor() as $p) {
                $text = trim($p->text_content ?? '');
                if ($text !== '' && preg_match('/subsection|section|paragraph|of the Act/i', $text)) {
                    $samples[] = mb_substr($text, 0, 240);
                }
            }
        }

        return array_values(array_unique($samples));
    }

    private function openAiAvailable(): bool
    {
        return (bool) config('legislation_sources.openai.enabled')
            && (bool) config('services.openai.key');
    }
}

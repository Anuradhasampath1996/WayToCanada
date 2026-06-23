<?php

namespace App\Services;

use App\Models\LegislationDocument;
use App\Models\LegislationReference;
use Illuminate\Support\Facades\Storage;

class LegislationReferenceRenderService
{
    public function __construct(
        private JusticeCanadaXmlParser $parser,
        private LegislationSyncService $sync,
    ) {}

    /** Re-parse stored XML for a clean linkify base (avoids double-wrapping). */
    public function freshBaseHtml(LegislationDocument $document): string
    {
        if ($document->format !== 'xml' || ! $document->storage_path) {
            return $document->rendered_html ?? '';
        }

        if (! Storage::disk('local')->exists($document->storage_path)) {
            return $document->rendered_html ?? '';
        }

        $content   = Storage::disk('local')->get($document->storage_path);
        $parentAct = config('legislation_sources.regulation_parent_acts', [])[$document->act_code] ?? null;
        $parsed    = $this->parser->parse($content, $document->act_code, $document->language, $parentAct);

        return $parsed['rendered_html'];
    }

    /** Apply manual references only (legacy). */
    public function applyManualReferences(LegislationDocument $document): string
    {
        return $this->finalizeDocumentHtml($document, $this->freshBaseHtml($document));
    }

    /** Apply cached refs, expand split prefixes, linkify only DB-verified provisions. */
    public function finalizeDocumentHtml(LegislationDocument $document, ?string $baseHtml = null): string
    {
        return $this->finalizeDocument($document, $baseHtml)['html'];
    }

    /**
     * @return array{
     *   html: string,
     *   stripped: int,
     *   unresolved_detected: int,
     *   unresolved_queued: int,
     *   verify_gated: bool
     * }
     */
    public function finalizeDocument(LegislationDocument $document, ?string $baseHtml = null): array
    {
        $html      = $baseHtml ?? $this->freshBaseHtml($document);
        $parentAct = config('legislation_sources.regulation_parent_acts', [])[$document->act_code] ?? null;

        if ($html === '') {
            return [
                'html'                => $html,
                'stripped'            => 0,
                'unresolved_detected' => 0,
                'unresolved_queued'   => 0,
                'verify_gated'        => true,
            ];
        }

        $resolveCache = [];
        $verifier     = function (string $act, string $key) use ($document, &$resolveCache): bool {
            $cacheKey = $act.':'.$key.':'.$document->language;
            if (! array_key_exists($cacheKey, $resolveCache)) {
                $resolveCache[$cacheKey] = $this->sync->canResolve($act, $key, $document->language);
            }

            return $resolveCache[$cacheKey];
        };

        $this->parser->beginVerifiedLinkify($verifier);

        $html = $this->applyAllCachedReferences($document, $html);
        $result = $this->expandPrefixLinks($html);
        $html = $result['html'];
        $lang = $document->language;
        $html = $this->parser->linkifyHtmlPreservingAnchors($html, $document->act_code, $parentAct, $lang);
        $html = $this->parser->linkifySectionListRemainders($html, $document->act_code);
        $html = $this->parser->linkifySectionOrRangeRemainders($html, $document->act_code, $lang);
        $html = $this->parser->linkifySubsectionAndListRemainders($html, $document->act_code);
        $html = $this->parser->linkifyContextualSubsections($html, $document->act_code, $lang);
        $html = $this->parser->linkifyParagraphListRemainders($html, $document->act_code, $lang);
        $html = $this->parser->linkifyShorthandOrRefs($html, $document->act_code, $lang);
        $html = $this->parser->linkifySectionShorthandRefs($html, $document->act_code, $lang);
        $result = $this->expandPrefixLinks($html);
        $html = $result['html'];
        $html = $this->parser->linkifySectionListRemainders($html, $document->act_code);
        $html = $this->parser->linkifySectionOrRangeRemainders($html, $document->act_code, $lang);
        $html = $this->parser->linkifySubsectionAndListRemainders($html, $document->act_code);
        $html = $this->parser->linkifyContextualSubsections($html, $document->act_code, $lang);
        $html = $this->parser->linkifyParagraphListRemainders($html, $document->act_code, $lang);
        $html = $this->parser->linkifyShorthandOrRefs($html, $document->act_code, $lang);
        $html = $this->parser->linkifySectionShorthandRefs($html, $document->act_code, $lang);

        $stripResult = $this->stripUnresolvableLinks($html, $document->language, $resolveCache);
        $html        = $stripResult['html'];

        $unresolved = $this->parser->getUnresolvedAttempts();
        $this->parser->endVerifiedLinkify();

        $queued = $this->queueUnresolvedReferences($document, $unresolved);

        return [
            'html'                => $html,
            'stripped'            => $stripResult['stripped'],
            'unresolved_detected' => count($unresolved),
            'unresolved_queued'   => $queued,
            'verify_gated'        => true,
        ];
    }

    /** @param  array<string, bool>  $resolveCache */
    private function stripUnresolvableLinks(string $html, string $language, array &$resolveCache): array
    {
        $stripped = 0;

        $html = preg_replace_callback(
            '/<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*data-act="([^"]*)"[^>]*data-key="([^"]*)"[^>]*>([^<]*)<\/a>/iu',
            function (array $m) use ($language, &$resolveCache, &$stripped) {
                $act   = $m[1];
                $key   = $m[2];
                $label = $m[3];

                if ($key === '' || $key === 'external') {
                    return htmlspecialchars($label);
                }

                $cacheKey = $act.':'.$key.':'.$language;
                if (! array_key_exists($cacheKey, $resolveCache)) {
                    $resolveCache[$cacheKey] = $this->sync->canResolve($act, $key, $language);
                }

                if ($resolveCache[$cacheKey]) {
                    return $m[0];
                }

                $stripped++;

                return htmlspecialchars($label);
            },
            $html
        ) ?? $html;

        return ['html' => $html, 'stripped' => $stripped];
    }

    /** @param  array<int, array{label: string, target_act_code: string, target_provision_key: string}>  $attempts */
    private function queueUnresolvedReferences(LegislationDocument $document, array $attempts): int
    {
        $queued = 0;

        foreach ($attempts as $attempt) {
            LegislationReference::updateOrCreate(
                [
                    'document_id'          => $document->id,
                    'label'                => $attempt['label'],
                    'target_act_code'      => $attempt['target_act_code'],
                    'target_provision_key' => $attempt['target_provision_key'],
                ],
                [
                    'source_type' => 'auto_xml',
                    'is_active'   => false,
                    'admin_notes' => 'Unresolved: provision not found in synced catalog.',
                ]
            );
            $queued++;
        }

        return $queued;
    }

    /** Apply all cached refs (manual + auto) onto base HTML. */
    public function applyAllCachedReferences(LegislationDocument $document, ?string $baseHtml = null): string
    {
        $html = $baseHtml ?? $this->freshBaseHtml($document);
        if ($html === '') {
            return $html;
        }

        $refs = $document->references()
            ->where('is_active', true)
            ->whereNotNull('target_act_code')
            ->whereNotNull('target_provision_key')
            ->orderByRaw('LENGTH(label) DESC')
            ->get();

        foreach ($refs as $ref) {
            $html = $this->injectReference($html, $ref);
        }

        return $html;
    }

    /**
     * Merge "subsection " + linked anchor into one full-text link.
     *
     * @return array{html: string, expanded: int}
     */
    public function expandPrefixLinks(string $html): array
    {
        $expanded = 0;

        $prefix = LegislationLinkifyTerms::expandPrefixPattern();

        $html = preg_replace_callback(
            '/\b(('.$prefix.')\s+)(<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*data-act="([^"]*)"[^>]*data-key="([^"]*)"[^>]*>)([^<]*)(<\/a>)/iu',
            function (array $m) use (&$expanded) {
                $prefix = $m[1];
                $act    = $m[4];
                $key    = $m[5];
                $inner  = trim($m[6]);
                $label  = trim($prefix.$inner);

                if ($inner === '' || stripos($inner, trim($prefix)) === 0) {
                    return $m[0];
                }

                $expanded++;
                $class = str_contains($m[0], 'leg-ref-cached') ? 'leg-ref leg-ref-cached'
                    : (str_contains($m[0], 'leg-ref-manual') ? 'leg-ref leg-ref-manual' : 'leg-ref');

                return '<a href="#" class="'.$class.'" data-act="'.htmlspecialchars($act, ENT_QUOTES).'" data-key="'.htmlspecialchars($key, ENT_QUOTES).'" data-ref="'.htmlspecialchars($act.':'.$key, ENT_QUOTES).'">'.htmlspecialchars($label).'</a>';
            },
            $html,
            -1,
            $count
        ) ?? $html;

        return ['html' => $html, 'expanded' => $expanded];
    }

    /** @return array<int, array{label: string, target_act_code: string, target_provision_key: string}> */
    public function discoverPrefixGapLabels(string $html): array
    {
        $gaps = [];
        $prefix = LegislationLinkifyTerms::expandPrefixPattern();
        preg_match_all(
            '/\b(('.$prefix.')\s+)(<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*data-act="([^"]*)"[^>]*data-key="([^"]*)"[^>]*>)([^<]*)(<\/a>)/iu',
            $html,
            $matches,
            PREG_SET_ORDER
        );

        foreach ($matches as $m) {
            $inner = trim($m[6]);
            $label = trim($m[1].$inner);
            if ($inner === '' || stripos($inner, trim($m[1])) === 0) {
                continue;
            }
            $gaps[] = [
                'label'                => $label,
                'target_act_code'      => $m[4],
                'target_provision_key' => $m[5],
            ];
        }

        return $gaps;
    }

    /** @return array<int, string> */
    public function findPlainTextGapLabels(string $html, string $language = 'en'): array
    {
        $linkedTexts = [];
        preg_match_all('/<a[^>]*class="[^"]*leg-ref[^"]*"[^>]*>([^<]*)<\/a>/iu', $html, $linked);
        foreach ($linked[1] as $text) {
            $linkedTexts[mb_strtolower(trim($text))] = true;
        }

        $patterns = LegislationLinkifyTerms::plainTextGapPatterns($language);

        $found = [];
        preg_match_all('/>([^<]+)</u', $html, $nodes);
        foreach ($nodes[1] as $text) {
            if (str_contains($text, 'leg-ref')) {
                continue;
            }
            foreach ($patterns as $pattern) {
                preg_match_all($pattern, $text, $matches);
                foreach ($matches[1] ?? $matches[0] ?? [] as $label) {
                    $label = trim($label);
                    $norm  = mb_strtolower($label);
                    if ($label !== '' && ! isset($linkedTexts[$norm]) && ! isset($found[$norm])) {
                        $found[$norm] = $label;
                    }
                }
            }
        }

        return array_values($found);
    }

    public function countPrefixGaps(string $html): int
    {
        $prefix = LegislationLinkifyTerms::expandPrefixPattern();
        preg_match_all(
            '/\b(?:'.$prefix.')\s+(?=<a\s+[^>]*class="[^"]*leg-ref)/iu',
            $html,
            $m
        );

        return count($m[0]);
    }

    private function injectReference(string $html, LegislationReference $ref): string
    {
        if (! $ref->target_act_code || ! $ref->target_provision_key) {
            return $html;
        }

        if (str_contains($html, '>'.$ref->label.'</a>')) {
            return $html;
        }

        $label = preg_quote($ref->label, '/');
        $act   = htmlspecialchars($ref->target_act_code, ENT_QUOTES);
        $key   = htmlspecialchars($ref->target_provision_key, ENT_QUOTES);
        $class = $ref->source_type === 'manual' ? 'leg-ref leg-ref-manual' : 'leg-ref leg-ref-cached';
        $anchor = '<a href="#" class="'.$class.'" data-act="'.$act.'" data-key="'.$key.'" data-ref="'.$act.':'.$key.'">'.htmlspecialchars($ref->label).'</a>';

        return preg_replace(
            '/(?<![">])('.$label.')(?![^<]*<\/a>)/iu',
            $anchor,
            $html
        ) ?? $html;
    }

    /** @return array<string, mixed>|null */
    public function previewReference(string $actCode, string $provisionKey, string $language = 'en'): ?array
    {
        return app(LegislationSyncService::class)->resolveReference($actCode, $provisionKey, $language);
    }

    public function refreshDocumentReferences(LegislationDocument $document): LegislationDocument
    {
        $merged = $this->finalizeDocumentHtml($document);
        $document->update(['rendered_html' => $merged]);

        return $document->fresh();
    }

    /** @return array{total: int, linked: int, unresolved: int, pending_queue: int, prefix_gaps: int, by_source: array<string, int>} */
    public function referenceCacheStats(LegislationDocument $document): array
    {
        $refs = $document->references()->where('is_active', true)->get();
        $bySource = [];
        $unresolved = 0;

        foreach ($refs as $ref) {
            $bySource[$ref->source_type] = ($bySource[$ref->source_type] ?? 0) + 1;
            if (! $ref->target_provision_key) {
                $unresolved++;
            }
        }

        $pendingQueue = $document->references()
            ->where('is_active', false)
            ->whereNotNull('target_provision_key')
            ->count();

        $html = $document->rendered_html ?? '';

        return [
            'total'         => $refs->count(),
            'linked'        => substr_count($html, 'class="leg-ref'),
            'unresolved'    => $unresolved,
            'pending_queue' => $pendingQueue,
            'prefix_gaps'   => $this->countPrefixGaps($html),
            'by_source'     => $bySource,
        ];
    }
}

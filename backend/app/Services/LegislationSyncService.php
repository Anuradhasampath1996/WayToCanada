<?php

namespace App\Services;

use App\Models\LegislationDocument;
use App\Models\LegislationProvision;
use App\Models\LegislationCatalogEntry;
use App\Models\LegislationSyncRun;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class LegislationSyncService
{
    public function __construct(
        private JusticeCanadaXmlParser $parser,
        private LegislationCatalogService $catalog,
    ) {}

    /** @return array<string, mixed> */
    public function syncStatus(): array
    {
        $latestRun = LegislationSyncRun::orderByDesc('id')->first();

        return [
            'document_count'     => LegislationDocument::count(),
            'provision_count'    => LegislationProvision::count(),
            'xml_documents'      => LegislationDocument::where('format', 'xml')->count(),
            'catalog'            => $this->catalog->catalogStats(),
            'configured_sources' => array_keys(config('legislation_sources.sources', [])),
            'openai_enabled'     => (bool) config('legislation_sources.openai.enabled'),
            'catalog_index_url'  => 'https://laws.justice.gc.ca/eng/acts/',
            'latest_run'         => $latestRun ? $this->formatSyncRun($latestRun) : null,
            'recent_documents' => LegislationDocument::orderByDesc('last_synced_at')
                ->limit(12)
                ->get()
                ->map(fn (LegislationDocument $d) => $this->formatDocument($d)),
        ];
    }

    public function startSyncRun(string $scope = 'all', ?string $sourceSlug = null, ?string $category = null): LegislationSyncRun
    {
        $totalSteps = 0;

        if ($scope === 'catalog' || $scope === 'catalog_batch') {
            $query = LegislationCatalogEntry::where('is_active', true)->whereNull('last_synced_at');
            if ($category) {
                $query->where('category', $category);
            }
            $totalSteps = $query->count() * 6;
        } elseif ($sourceSlug) {
            $cfg = config("legislation_sources.sources.{$sourceSlug}")
                ?? $this->catalog->buildActSourceConfig($sourceSlug, $sourceSlug);
            if ($cfg) {
                $totalSteps = count($cfg['formats'] ?? []) * 2;
            }
        } else {
            foreach (array_keys(config('legislation_sources.sources', [])) as $slug) {
                $cfg = config("legislation_sources.sources.{$slug}");
                if ($cfg) {
                    $totalSteps += count($cfg['formats'] ?? []) * 2;
                }
            }
        }

        return LegislationSyncRun::create([
            'status'          => 'pending',
            'scope'           => $scope,
            'source_slug'     => $sourceSlug,
            'total_steps'     => max($totalSteps, 1),
            'completed_steps' => 0,
            'current_step'    => 'Queued',
            'stats'           => ['category' => $category],
        ]);
    }

    /** @return array<string, mixed> */
    public function runSync(LegislationSyncRun $run, ?string $sourceSlug = null): array
    {
        $run->update(['status' => 'running', 'started_at' => now(), 'current_step' => 'Starting sync']);

        $sources = $this->resolveSources($run, $sourceSlug);

        $stats = ['created' => 0, 'updated' => 0, 'errors' => []];

        try {
            foreach ($sources as $slug => $cfg) {
                if (! $cfg) {
                    continue;
                }
                $run->update(['current_step' => "Syncing {$slug}"]);
                $result = $this->syncSource($slug, $cfg, $run);
                $stats['created'] += $result['created'];
                $stats['updated'] += $result['updated'];
                if (! empty($result['errors'])) {
                    $stats['errors'] = array_merge($stats['errors'], $result['errors']);
                }
            }

            $this->pairLanguageDocuments();
            $run->update([
                'status'          => empty($stats['errors']) ? 'completed' : 'completed',
                'finished_at'     => now(),
                'current_step'    => 'Complete',
                'stats'           => $stats,
                'completed_steps' => $run->total_steps,
            ]);
        } catch (\Throwable $e) {
            $run->update([
                'status'        => 'failed',
                'finished_at'   => now(),
                'error_message' => $e->getMessage(),
                'current_step'  => 'Failed',
            ]);
            throw $e;
        }

        return $stats;
    }

    /** @return array{created: int, updated: int, errors: array<int, string>} */
    public function syncSource(string $slug, array $cfg, ?LegislationSyncRun $run = null): array
    {
        $baseUrl = rtrim(config('legislation_sources.base_url'), '/');
        $created = $updated = 0;
        $errors  = [];
        $actCode = $cfg['act_code'];
        $parent  = $cfg['parent_act_code'] ?? null;

        foreach ($cfg['formats'] as $format => $langPaths) {
            foreach ($langPaths as $lang => $path) {
                $url = $baseUrl.$path;
                if ($run) {
                    $run->increment('completed_steps');
                    $run->update(['current_step' => "{$slug}/{$format}/{$lang}"]);
                }

                try {
                    $response = Http::timeout(120)->get($url);
                    if (! $response->successful()) {
                        $errors[] = "{$slug}/{$format}/{$lang}: HTTP {$response->status()}";
                        continue;
                    }

                    $content = $response->body();
                    $hash    = hash('sha256', $content);
                    $docSlug = "{$slug}-{$lang}-{$format}";

                    $existing = LegislationDocument::where('slug', $docSlug)->first();
                    $isNew    = ! $existing;

                    $storagePath = "legislation/{$docSlug}".($format === 'xml' ? '.xml' : ($format === 'pdf' ? '.pdf' : '.html'));
                    Storage::disk('local')->put($storagePath, $content);

                    $renderedHtml = null;
                    $provisions   = [];
                    $meta         = [];

                    if ($format === 'xml') {
                        $parsed = $this->parser->parse($content, $actCode, $lang, $parent);
                        $renderedHtml = $parsed['rendered_html'];
                        $provisions   = $parsed['provisions'];
                        $meta         = $parsed['metadata'];
                    } elseif ($format === 'html') {
                        $renderedHtml = '<div class="leg-html-body">'.$content.'</div>';
                    }

                    $doc = LegislationDocument::updateOrCreate(
                        ['slug' => $docSlug],
                        [
                            'source_slug'      => $slug,
                            'act_code'         => $actCode,
                            'title'            => $cfg['title'],
                            'language'         => $lang,
                            'format'           => $format,
                            'category'         => $cfg['category'] ?? 'act',
                            'source_url'       => $url,
                            'storage_path'     => $storagePath,
                            'content_hash'     => $hash,
                            'file_size'        => strlen($content),
                            'rendered_html'    => $renderedHtml,
                            'provisions_count' => count($provisions),
                            'last_synced_at'   => now(),
                            'metadata'         => $meta,
                        ]
                    );

                    if ($format === 'xml' && $provisions) {
                        LegislationProvision::where('document_id', $doc->id)->delete();
                        foreach ($provisions as $p) {
                            LegislationProvision::create(array_merge($p, ['document_id' => $doc->id]));
                        }
                        app(LegislationReferenceRenderService::class)->refreshDocumentReferences($doc->fresh());
                    }

                    $isNew ? $created++ : $updated++;
                } catch (\Throwable $e) {
                    $errors[] = "{$slug}/{$format}/{$lang}: {$e->getMessage()}";
                }
            }
        }

        return compact('created', 'updated', 'errors');
    }

    /** @return array<string, array> */
    private function resolveSources(LegislationSyncRun $run, ?string $sourceSlug): array
    {
        if ($sourceSlug) {
            $cfg = config("legislation_sources.sources.{$sourceSlug}");
            if (! $cfg) {
                $entry = LegislationCatalogEntry::where('act_code', $sourceSlug)->first();
                if ($entry) {
                    $slug = $this->catalog->sourceSlugForEntry($entry);

                    return [$slug => $this->catalog->buildSourceConfig($entry)];
                }
            }

            return [$sourceSlug => $cfg];
        }

        if ($run->scope === 'catalog') {
            return $this->catalog->catalogSourcesMap();
        }

        return config('legislation_sources.sources', []);
    }

    /** @return array{created: int, updated: int, errors: array<int, string>} */
    public function syncCatalogEntry(LegislationCatalogEntry $entry, ?LegislationSyncRun $run = null): array
    {
        $slug   = $this->catalog->sourceSlugForEntry($entry);
        $cfg    = $this->catalog->buildSourceConfig($entry);
        $result = $this->syncSource($slug, $cfg, $run);

        $docCount = LegislationDocument::where('source_slug', $slug)->count();
        $entry->update([
            'last_synced_at'   => now(),
            'documents_synced' => $docCount,
        ]);

        $this->pairLanguageDocuments();

        return $result;
    }

    /** @return array<int, LegislationCatalogEntry> */
    public function nextCatalogBatch(?string $category = null, int $limit = 5, bool $onlyUnsynced = true): array
    {
        $query = LegislationCatalogEntry::where('is_active', true)->orderBy('act_code');
        if ($onlyUnsynced) {
            $query->whereNull('last_synced_at');
        }
        if ($category) {
            $query->where('category', $category);
        }

        return $query->limit($limit)->get()->all();
    }

    /** @param array<int, LegislationCatalogEntry> $entries */
    public function runCatalogBatch(LegislationSyncRun $run, array $entries): array
    {
        $stats = ['created' => 0, 'updated' => 0, 'errors' => [], 'synced_entries' => 0];

        foreach ($entries as $entry) {
            $run->update(['current_step' => "Catalog: {$entry->act_code} ({$entry->title})"]);
            $result = $this->syncCatalogEntry($entry, $run);
            $stats['created'] += $result['created'];
            $stats['updated'] += $result['updated'];
            $stats['errors']  = array_merge($stats['errors'], $result['errors']);
            $stats['synced_entries']++;
        }

        $this->pairLanguageDocuments();

        return $stats;
    }

    private function pairLanguageDocuments(): void
    {
        $slugs = LegislationDocument::query()
            ->select('source_slug')
            ->distinct()
            ->pluck('source_slug');

        foreach ($slugs as $slug) {
            foreach (['xml', 'html', 'pdf'] as $format) {
                $en = LegislationDocument::where('source_slug', $slug)->where('language', 'en')->where('format', $format)->first();
                $fr = LegislationDocument::where('source_slug', $slug)->where('language', 'fr')->where('format', $format)->first();
                if ($en && $fr) {
                    $en->update(['paired_document_id' => $fr->id]);
                    $fr->update(['paired_document_id' => $en->id]);
                }
            }
        }
    }

    /** @return array<string, mixed>|null */
    public function resolveReference(string $actCode, string $provisionKey, string $language = 'en'): ?array
    {
        $provisionKey = trim($provisionKey);
        if ($provisionKey === '' || $provisionKey === 'external') {
            return null;
        }

        foreach ($this->actsToSearch($actCode, $provisionKey) as $searchAct) {
            $provision = $this->lookupProvision($searchAct, $provisionKey, $language);
            if ($provision) {
                return $this->formatResolvedProvision($provision);
            }
        }

        return null;
    }

    public function canResolve(string $actCode, string $provisionKey, string $language = 'en'): bool
    {
        return $this->resolveReference($actCode, $provisionKey, $language) !== null;
    }

    /** @return array<int, string> */
    private function actsToSearch(string $actCode, string $provisionKey): array
    {
        $parents = config('legislation_sources.regulation_parent_acts', []);
        $parent  = $parents[$actCode] ?? null;

        if ($parent && preg_match('/\d+\(\d+\)(?:\([^)]+\))+/', $provisionKey)) {
            return [$parent, $actCode];
        }

        $acts = [$actCode];
        if ($parent) {
            $acts[] = $parent;
        }

        return array_values(array_unique($acts));
    }

    private function lookupProvision(string $actCode, string $key, string $language): ?LegislationProvision
    {
        $key = preg_replace('/\s+/', '', $key) ?? $key;

        $exact = LegislationProvision::where('act_code', $actCode)
            ->where('language', $language)
            ->where('provision_key', $key)
            ->first();

        if ($exact) {
            return $exact;
        }

        if (preg_match_all('/\([^)]+\)/', $key, $m)) {
            $base  = preg_replace('/\([^)]+\)/', '', $key) ?? $key;
            $built = $base;
            $candidates = [];
            foreach ($m[0] as $part) {
                $built .= $part;
                $candidates[] = $built;
            }
            foreach (array_reverse($candidates) as $candidate) {
                $row = LegislationProvision::where('act_code', $actCode)
                    ->where('language', $language)
                    ->where('provision_key', $candidate)
                    ->first();
                if ($row) {
                    return $row;
                }
            }
        }

        return null;
    }

    /** @return array<string, mixed> */
    public function formatDocument(LegislationDocument $d): array
    {
        return [
            'id'               => $d->id,
            'slug'             => $d->slug,
            'source_slug'      => $d->source_slug,
            'act_code'         => $d->act_code,
            'title'            => $d->title,
            'language'         => $d->language,
            'format'           => $d->format,
            'category'         => $d->category,
            'source_url'       => $d->source_url,
            'file_size'        => $d->file_size,
            'provisions_count' => $d->provisions_count,
            'last_synced_at'   => $d->last_synced_at?->toIso8601String(),
            'metadata'         => $d->metadata,
            'has_viewer'       => in_array($d->format, ['xml', 'html'], true) && ! empty($d->rendered_html),
            'paired_document_id' => $d->paired_document_id,
            'ai_analyzed'      => $d->ai_analyzed,
        ];
    }

    /** @return array<string, mixed> */
    private function formatResolvedProvision(LegislationProvision $provision): array
    {
        $doc = $provision->document;

        return [
            'act_code'       => $provision->act_code,
            'provision_key'  => $provision->provision_key,
            'language'       => $provision->language,
            'marginal_note'  => $provision->marginal_note,
            'text_content'   => $provision->text_content,
            'html_fragment'  => $provision->html_fragment,
            'popup_html'     => $this->buildPopupHtml($provision),
            'document'       => [
                'id'    => $doc->id,
                'title' => $doc->title,
                'slug'  => $doc->slug,
            ],
            'citation' => $this->formatCitation($provision),
        ];
    }

    private function buildPopupHtml(LegislationProvision $p): string
    {
        $parts = ['<div class="leg-popup-structured">'];

        if ($p->section_label) {
            $parts[] = '<div class="leg-popup-section">Section '.htmlspecialchars($this->formatSectionHeading($p)).'</div>';
        }

        $marginal = $p->marginal_note;
        if (! $marginal && $p->subsection_label) {
            $section = $this->lookupProvision($p->act_code, (string) $p->section_label, $p->language);
            if ($section?->marginal_note && ! $section->subsection_label) {
                $marginal = $section->marginal_note;
            }
        }
        if ($marginal) {
            $parts[] = '<div class="leg-popup-marginal">'.htmlspecialchars((string) $marginal).'</div>';
        }

        $parts[] = '<div class="leg-popup-body-text">'.$p->html_fragment.'</div>';
        $parts[] = '</div>';

        return implode("\n", $parts);
    }

    private function formatSectionHeading(LegislationProvision $p): string
    {
        $heading = (string) $p->section_label;
        if ($p->subsection_label) {
            $heading .= '('.trim((string) $p->subsection_label, '()').')';
        }
        if ($p->paragraph_label) {
            $heading .= '('.trim((string) $p->paragraph_label, '()').')';
        }

        return $heading;
    }

    private function formatCitation(LegislationProvision $p): string
    {
        return $p->act_code.' — Section '.$this->formatSectionHeading($p);
    }

    /** @return array<string, mixed> */
    public function formatSyncRun(LegislationSyncRun $run): array
    {
        return [
            'id'               => $run->id,
            'status'           => $run->status,
            'scope'            => $run->scope,
            'source_slug'      => $run->source_slug,
            'total_steps'      => $run->total_steps,
            'completed_steps'  => $run->completed_steps,
            'progress_percent' => $run->progressPercent(),
            'current_step'     => $run->current_step,
            'stats'            => $run->stats,
            'error_message'    => $run->error_message,
            'started_at'       => $run->started_at?->toIso8601String(),
            'finished_at'      => $run->finished_at?->toIso8601String(),
        ];
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\RunLegislationSyncJob;
use App\Jobs\SyncLegislationCatalogBatchJob;
use App\Models\LegislationCatalogEntry;
use App\Models\LegislationDocument;
use App\Models\LegislationReference;
use App\Models\LegislationSyncRun;
use App\Services\LegislationCatalogService;
use App\Services\LegislationReferenceAiService;
use App\Services\LegislationReferenceRenderService;
use App\Services\LegislationSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminLegislationController extends Controller
{
    /** GET /api/v1/admin/legislation/sync-status */
    public function syncStatus(LegislationSyncService $sync): JsonResponse
    {
        return response()->json($sync->syncStatus());
    }

    /** GET /api/v1/admin/legislation/catalog */
    public function catalog(Request $request, LegislationCatalogService $catalog): JsonResponse
    {
        $data = $request->validate([
            'search'   => 'nullable|string|max:120',
            'category' => 'nullable|string|in:act,regulation',
            'per_page' => 'nullable|integer|min:5|max:100',
        ]);

        $paginator = $catalog->listCatalog(
            $data['search'] ?? null,
            $data['category'] ?? null,
            $data['per_page'] ?? 25,
        );

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
            'stats' => $catalog->catalogStats(),
        ]);
    }

    /** GET /api/v1/admin/legislation/sync-runs/{run} */
    public function syncRun(LegislationSyncRun $run, LegislationSyncService $sync): JsonResponse
    {
        return response()->json(['data' => $sync->formatSyncRun($run)]);
    }

    /** POST /api/v1/admin/legislation/discover-catalog */
    public function discoverCatalog(Request $request, LegislationCatalogService $catalog): JsonResponse
    {
        $data = $request->validate([
            'type' => 'nullable|string|in:acts,regulations,both',
        ]);

        $type = $data['type'] ?? 'acts';
        $results = [];

        if ($type === 'acts' || $type === 'both') {
            $results['acts'] = $catalog->discoverActs();
        }
        if ($type === 'regulations' || $type === 'both') {
            $results['regulations'] = $catalog->discoverRegulations();
        }

        return response()->json([
            'message' => 'Catalog discovery completed.',
            'data'    => $results,
            'stats'   => $catalog->catalogStats(),
        ]);
    }

    /** POST /api/v1/admin/legislation/sync */
    public function sync(Request $request, LegislationSyncService $sync): JsonResponse
    {
        $data = $request->validate([
            'source'       => 'nullable|string|max:80',
            'scope'        => 'nullable|string|in:all,catalog,catalog_batch,source',
            'category'     => 'nullable|string|in:act,regulation',
            'batch_size'   => 'nullable|integer|min:1|max:20',
            'only_unsynced'=> 'nullable|boolean',
            'async'        => 'nullable|boolean',
            'run_ai'       => 'nullable|boolean',
        ]);

        $sourceSlug   = $data['source'] ?? null;
        $scope        = $data['scope'] ?? ($sourceSlug ? 'source' : 'all');
        $category     = $data['category'] ?? null;
        $batchSize    = $data['batch_size'] ?? 5;
        $onlyUnsynced = $data['only_unsynced'] ?? true;
        $run          = $sync->startSyncRun($scope, $sourceSlug, $category);

        if ($scope === 'catalog_batch') {
            if ($data['async'] ?? true) {
                SyncLegislationCatalogBatchJob::dispatch($run->id, $category, $batchSize, $onlyUnsynced);

                return response()->json([
                    'message' => "Catalog batch sync started ({$batchSize} entries per batch).",
                    'run'     => $sync->formatSyncRun($run->fresh()),
                ], 202);
            }

            $entries = $sync->nextCatalogBatch($category, $batchSize, $onlyUnsynced);
            $stats   = $sync->runCatalogBatch($run, $entries);
            $run->update(['status' => 'completed', 'finished_at' => now(), 'stats' => $stats, 'current_step' => 'Complete']);

            return response()->json([
                'message' => 'Catalog batch sync completed.',
                'run'     => $sync->formatSyncRun($run->fresh()),
            ]);
        }

        if ($data['async'] ?? true) {
            RunLegislationSyncJob::dispatch($run->id, $sourceSlug, (bool) ($data['run_ai'] ?? false));

            return response()->json([
                'message' => 'Legislation sync started in background.',
                'run'     => $sync->formatSyncRun($run->fresh()),
            ], 202);
        }

        $sync->runSync($run, $sourceSlug);
        if ($data['run_ai'] ?? false) {
            foreach (LegislationDocument::where('format', 'xml')->cursor() as $doc) {
                app(LegislationReferenceAiService::class)->analyzeDocument($doc);
            }
        }

        return response()->json([
            'message' => 'Legislation sync completed.',
            'run'     => $sync->formatSyncRun($run->fresh()),
        ]);
    }

    /** POST /api/v1/admin/legislation/catalog/{entry}/sync */
    public function syncCatalogEntry(LegislationCatalogEntry $entry, Request $request, LegislationSyncService $sync): JsonResponse
    {
        $data = $request->validate([
            'async' => 'nullable|boolean',
        ]);

        if ($data['async'] ?? false) {
            $run = $sync->startSyncRun('source', $entry->act_code);
            RunLegislationSyncJob::dispatch($run->id, $entry->act_code, false);

            return response()->json([
                'message' => "Sync queued for {$entry->act_code}.",
                'run'     => $sync->formatSyncRun($run),
            ], 202);
        }

        $result = $sync->syncCatalogEntry($entry);

        return response()->json([
            'message' => "Synced {$entry->act_code}.",
            'data'    => $result,
            'entry'   => $entry->fresh(),
        ]);
    }

    /** GET /api/v1/admin/legislation/documents */
    public function documents(Request $request, LegislationSyncService $sync): JsonResponse
    {
        $query = LegislationDocument::query()->orderBy('source_slug')->orderBy('language')->orderBy('format');

        if ($request->filled('language')) {
            $query->where('language', $request->string('language'));
        }
        if ($request->filled('format')) {
            $query->where('format', $request->string('format'));
        }
        if ($request->filled('act_code')) {
            $query->where('act_code', $request->string('act_code'));
        }

        return response()->json([
            'data' => $query->get()->map(fn (LegislationDocument $d) => $sync->formatDocument($d)),
        ]);
    }

    /** GET /api/v1/admin/legislation/documents/{document} */
    public function showDocument(LegislationDocument $document, LegislationSyncService $sync): JsonResponse
    {
        return response()->json([
            'data' => array_merge($sync->formatDocument($document), [
                'rendered_html' => $document->rendered_html,
            ]),
        ]);
    }

    /** GET /api/v1/admin/legislation/documents/{document}/download */
    public function downloadDocument(LegislationDocument $document): StreamedResponse|JsonResponse
    {
        if (! $document->storage_path || ! Storage::disk('local')->exists($document->storage_path)) {
            return response()->json(['message' => 'Stored file not found. Re-run sync for this document.'], 404);
        }

        $ext      = pathinfo($document->storage_path, PATHINFO_EXTENSION) ?: $document->format;
        $filename = "{$document->act_code}-{$document->language}.{$ext}";

        return Storage::disk('local')->download($document->storage_path, $filename);
    }

    /** POST /api/v1/admin/legislation/documents/{document}/analyze */
    public function analyzeDocument(Request $request, LegislationDocument $document, LegislationReferenceAiService $ai): JsonResponse|\Symfony\Component\HttpFoundation\StreamedResponse
    {
        if ($document->format !== 'xml') {
            return response()->json(['message' => 'AI analysis is only available for XML documents.'], 422);
        }

        $data = $request->validate([
            'use_openai' => 'nullable|boolean',
            'stream'     => 'nullable|boolean',
        ]);

        $useOpenAi = $data['use_openai'] ?? true;

        if ($request->boolean('stream')) {
            return response()->stream(function () use ($document, $ai, $useOpenAi) {
                $send = function (array $payload): void {
                    echo 'data: '.json_encode($payload)."\n\n";
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();
                };

                try {
                    $result = $ai->analyzeLinkifyAndCache($document, $useOpenAi, function (array $progress) use ($send) {
                        $send(['type' => 'progress', ...$progress]);
                    });

                    $message = $this->analyzeLinkifyMessage($result);

                    $send(['type' => 'complete', 'message' => $message, 'data' => $result]);
                } catch (\Throwable $e) {
                    $send(['type' => 'error', 'message' => $e->getMessage()]);
                }
            }, 200, [
                'Content-Type'      => 'text/event-stream',
                'Cache-Control'     => 'no-cache, no-transform',
                'X-Accel-Buffering' => 'no',
                'Connection'        => 'keep-alive',
            ]);
        }

        $result = $ai->analyzeLinkifyAndCache($document, $useOpenAi);
        unset($result['rendered_html']);

        return response()->json([
            'message' => $this->analyzeLinkifyMessage($result),
            'data' => $result,
        ]);
    }

    /** POST /api/v1/admin/legislation/documents/{document}/analyze-and-linkify */
    public function analyzeAndLinkify(Request $request, LegislationDocument $document, LegislationReferenceAiService $ai): JsonResponse|\Symfony\Component\HttpFoundation\StreamedResponse
    {
        return $this->analyzeDocument($request, $document, $ai);
    }

    /** GET /api/v1/admin/legislation/documents/{document}/reference-cache */
    public function referenceCache(LegislationDocument $document, LegislationReferenceRenderService $render): JsonResponse
    {
        return response()->json([
            'data' => [
                'stats'      => $render->referenceCacheStats($document),
                'references' => $document->references()->where('is_active', true)->orderBy('label')->limit(100)->get(),
            ],
        ]);
    }

    /** POST /api/v1/admin/legislation/documents/{document}/apply-references */
    public function applyReferences(LegislationDocument $document, LegislationReferenceRenderService $render): JsonResponse
    {
        $updated = $render->refreshDocumentReferences($document);

        return response()->json([
            'message' => 'Manual references applied to document HTML.',
            'data'    => [
                'id'            => $updated->id,
                'rendered_html' => $updated->rendered_html,
            ],
        ]);
    }

    /** GET /api/v1/admin/legislation/references/preview */
    public function previewReference(Request $request, LegislationReferenceRenderService $render): JsonResponse
    {
        $data = $request->validate([
            'act'      => 'required|string|max:40',
            'key'      => 'required|string|max:80',
            'language' => 'nullable|string|in:en,fr',
        ]);

        $preview = $render->previewReference(
            $data['act'],
            $data['key'],
            $data['language'] ?? 'en',
        );

        if (! $preview) {
            return response()->json(['message' => 'Provision not found in synced documents.'], 404);
        }

        return response()->json(['data' => $preview]);
    }

    /** GET /api/v1/admin/legislation/resolve?act=&key=&language= */
    public function resolve(Request $request, LegislationSyncService $sync): JsonResponse
    {
        $data = $request->validate([
            'act'      => 'required|string|max:40',
            'key'      => 'required|string|max:80',
            'language' => 'nullable|string|in:en,fr',
        ]);

        $resolved = $sync->resolveReference(
            $data['act'],
            $data['key'],
            $data['language'] ?? 'en',
        );

        if (! $resolved) {
            return response()->json([
                'message' => 'Referenced provision not found in synced documents.',
                'hint'    => 'Run Legislation Hub sync if this act was recently added.',
            ], 404);
        }

        $override = LegislationReference::query()
            ->where('target_act_code', $data['act'])
            ->where('target_provision_key', $data['key'])
            ->where('is_active', true)
            ->whereNotNull('custom_popup_html')
            ->first();
        if ($override?->custom_popup_html) {
            $resolved['popup_html'] = $override->custom_popup_html;
        }

        return response()->json(['data' => $resolved]);
    }

    /** GET /api/v1/admin/legislation/documents/{document}/references */
    public function references(Request $request, LegislationDocument $document): JsonResponse
    {
        $query = $document->references()->orderBy('label');

        $status = $request->query('status', 'all');
        if ($status === 'pending') {
            $query->where('is_active', false)->whereNotNull('target_provision_key');
        } elseif ($status === 'active') {
            $query->where('is_active', true);
        }

        return response()->json([
            'data' => $query->get(),
            'meta' => [
                'pending_count' => $document->references()
                    ->where('is_active', false)
                    ->whereNotNull('target_provision_key')
                    ->count(),
            ],
        ]);
    }

    /** POST /api/v1/admin/legislation/documents/{document}/references */
    public function storeReference(Request $request, LegislationDocument $document, LegislationReferenceRenderService $render): JsonResponse
    {
        $data = $request->validate([
            'label'                => 'required|string|max:200',
            'target_act_code'      => 'nullable|string|max:40',
            'target_provision_key' => 'nullable|string|max:80',
            'source_text'          => 'nullable|string|max:500',
            'char_start'           => 'nullable|integer|min:0',
            'char_end'             => 'nullable|integer|min:0',
            'custom_popup_html'    => 'nullable|string',
            'admin_notes'          => 'nullable|string|max:1000',
            'is_external'          => 'nullable|boolean',
            'apply_now'            => 'nullable|boolean',
        ]);

        $ref = $document->references()->create(array_merge($data, [
            'source_type' => 'manual',
            'is_active'   => true,
        ]));

        if ($data['apply_now'] ?? true) {
            $render->refreshDocumentReferences($document->fresh());
        }

        return response()->json(['data' => $ref, 'message' => 'Reference created.'], 201);
    }

    /** PUT /api/v1/admin/legislation/references/{reference} */
    public function updateReference(Request $request, LegislationReference $reference, LegislationReferenceRenderService $render): JsonResponse
    {
        $data = $request->validate([
            'label'                => 'sometimes|string|max:200',
            'target_act_code'      => 'nullable|string|max:40',
            'target_provision_key' => 'nullable|string|max:80',
            'custom_popup_html'    => 'nullable|string',
            'admin_notes'          => 'nullable|string|max:1000',
            'is_active'            => 'nullable|boolean',
            'apply_now'            => 'nullable|boolean',
        ]);

        $reference->update($data);

        if ($data['apply_now'] ?? false) {
            $render->refreshDocumentReferences($reference->document);
        }

        return response()->json(['data' => $reference->fresh(), 'message' => 'Reference updated.']);
    }

    /** POST /api/v1/admin/legislation/references/{reference}/activate */
    public function activateReference(
        LegislationReference $reference,
        LegislationSyncService $sync,
        LegislationReferenceRenderService $render,
    ): JsonResponse {
        if (! $reference->target_act_code || ! $reference->target_provision_key) {
            return response()->json(['message' => 'Target act and provision key are required.'], 422);
        }

        $document = $reference->document;
        if (! $sync->canResolve($reference->target_act_code, $reference->target_provision_key, $document->language)) {
            return response()->json([
                'message' => 'Provision still not found in synced catalog. Sync the parent act first.',
            ], 422);
        }

        $reference->update([
            'is_active'   => true,
            'admin_notes' => null,
        ]);

        $render->refreshDocumentReferences($document);

        return response()->json([
            'data'    => $reference->fresh(),
            'message' => 'Reference activated and applied to document.',
        ]);
    }

    /** DELETE /api/v1/admin/legislation/references/{reference} */
    public function destroyReference(LegislationReference $reference, LegislationReferenceRenderService $render): JsonResponse
    {
        $document = $reference->document;
        $reference->delete();
        $render->refreshDocumentReferences($document);

        return response()->json(['message' => 'Reference deleted.']);
    }

    /** @param  array<string, mixed>  $result */
    private function analyzeLinkifyMessage(array $result): string
    {
        $totalLinks = ($result['already_linked'] ?? 0) + ($result['linked'] ?? 0);
        $stripped   = (int) ($result['stripped_broken'] ?? 0);
        $queued     = (int) ($result['unresolved_queued'] ?? 0);
        $verifyNote = ($result['verify_gated'] ?? false)
            ? sprintf(' %d broken links removed, %d queued for admin.', $stripped, $queued)
            : '';

        if (($result['linked'] ?? 0) === 0 && ($result['expanded'] ?? 0) === 0 && ($result['prefix_gaps_after'] ?? 0) === 0) {
            return sprintf(
                'Document fully linkified (%d verified links). %d patterns cached%s.%s',
                $totalLinks,
                $result['cached'] ?? 0,
                ($result['openai_used'] ?? false) ? ' with OpenAI' : '',
                $verifyNote,
            );
        }

        return sprintf(
            'Analysis complete: %d cached, %d newly linked, %d prefix expanded, %d unresolved at cache.%s Remaining split refs: %d.',
            $result['cached'] ?? 0,
            $result['linked'] ?? 0,
            $result['expanded'] ?? 0,
            $result['unresolved'] ?? 0,
            $verifyNote,
            $result['prefix_gaps_after'] ?? 0,
        );
    }
}

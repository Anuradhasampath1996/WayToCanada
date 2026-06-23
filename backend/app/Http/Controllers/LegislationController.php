<?php

namespace App\Http\Controllers;

use App\Models\LegislationDocument;
use App\Services\LegislationHubListService;
use App\Services\LegislationPopupSummaryService;
use App\Services\LegislationProvisionSearchService;
use App\Services\LegislationSelectionExplainService;
use App\Services\LegislationSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LegislationController extends Controller
{
    /** GET /api/v1/legislation/hub — grouped, paginated hub list with featured priority acts */
    public function hub(Request $request, LegislationHubListService $hub): JsonResponse
    {
        return response()->json($hub->listHub($request));
    }

    /** GET /api/v1/legislation/documents */
    public function documents(Request $request, LegislationSyncService $sync): JsonResponse
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
        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(function ($q) use ($term) {
                $q->where('title', 'like', $term)
                    ->orWhere('act_code', 'like', $term)
                    ->orWhere('source_slug', 'like', $term);
            });
        }

        return response()->json([
            'data' => $query->get()->map(fn (LegislationDocument $d) => $sync->formatDocument($d)),
        ]);
    }

    /** GET /api/v1/legislation/search */
    public function search(Request $request, LegislationProvisionSearchService $search): JsonResponse
    {
        $data = $request->validate([
            'q'        => 'required|string|min:2|max:500',
            'language' => 'nullable|string|in:en,fr,all',
            'limit'    => 'nullable|integer|min:1|max:30',
            'ai'       => 'nullable|boolean',
        ]);

        $payload = $search->search(
            $data['q'],
            $data['language'] ?? 'en',
            (int) ($data['limit'] ?? 12),
            (bool) ($data['ai'] ?? true),
        );

        return response()->json($payload);
    }

    /** GET /api/v1/legislation/capabilities */
    public function capabilities(
        LegislationProvisionSearchService $search,
        LegislationPopupSummaryService $summaries,
    ): JsonResponse {
        return response()->json([
            'data' => [
                'openai_available'        => $search->openAiAvailable(),
                'smart_search_available'  => true,
                'popup_summary_available' => $summaries->openAiAvailable(),
            ],
        ]);
    }

    /** GET /api/v1/legislation/documents/{document} */
    public function show(LegislationDocument $document, LegislationSyncService $sync): JsonResponse
    {
        if ($document->format === 'pdf') {
            return response()->json([
                'data' => $sync->formatDocument($document),
            ]);
        }

        if (! in_array($document->format, ['xml', 'html'], true) || empty($document->rendered_html)) {
            return response()->json(['message' => 'Document viewer not available for this format.'], 404);
        }

        return response()->json([
            'data' => array_merge($sync->formatDocument($document), [
                'rendered_html' => $document->rendered_html,
            ]),
        ]);
    }

    /** GET /api/v1/legislation/documents/{document}/download */
    public function download(LegislationDocument $document): StreamedResponse|JsonResponse
    {
        if (! $document->storage_path || ! Storage::disk('local')->exists($document->storage_path)) {
            return response()->json(['message' => 'Stored file not found.'], 404);
        }

        $ext      = pathinfo($document->storage_path, PATHINFO_EXTENSION) ?: $document->format;
        $filename = ($document->act_code ?? $document->source_slug).'-'.$document->language.'.'.$ext;

        return Storage::disk('local')->download($document->storage_path, $filename);
    }

    /** GET /api/v1/legislation/resolve?act=&key=&language=&summary=1 */
    public function resolve(
        Request $request,
        LegislationSyncService $sync,
        LegislationPopupSummaryService $summaries,
    ): JsonResponse {
        $data = $request->validate([
            'act'      => 'required|string|max:40',
            'key'      => 'required|string|max:80',
            'language' => 'nullable|string|in:en,fr',
            'summary'  => 'nullable|boolean',
        ]);

        $resolved = $sync->resolveReference(
            $data['act'],
            $data['key'],
            $data['language'] ?? 'en'
        );

        if (! $resolved) {
            return response()->json([
                'message' => 'Referenced provision not found in synced documents.',
                'hint'    => 'Run Legislation Hub sync in admin if this act was recently added.',
            ], 404);
        }

        $override = \App\Models\LegislationReference::query()
            ->where('target_act_code', $data['act'])
            ->where('target_provision_key', $data['key'])
            ->where('is_active', true)
            ->whereNotNull('custom_popup_html')
            ->first();
        if ($override?->custom_popup_html) {
            $resolved['popup_html'] = $override->custom_popup_html;
        }

        $wantSummary = (bool) ($data['summary'] ?? true);
        $resolved['maple_summary'] = $wantSummary ? $summaries->summarize($resolved) : null;
        $resolved['summary_available'] = $summaries->openAiAvailable();

        return response()->json(['data' => $resolved]);
    }

    /** POST /api/v1/legislation/explain */
    public function explain(Request $request, LegislationSelectionExplainService $explain): JsonResponse
    {
        $data = $request->validate([
            'text'           => 'required|string|min:10|max:8000',
            'citation'       => 'nullable|string|max:200',
            'client_context' => 'nullable|string|max:2000',
        ]);

        try {
            $result = $explain->explain(
                $data['text'],
                $data['citation'] ?? null,
                $data['client_context'] ?? null,
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['data' => $result]);
    }
}

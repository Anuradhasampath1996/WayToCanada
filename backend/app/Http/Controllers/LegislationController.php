<?php

namespace App\Http\Controllers;

use App\Models\LegislationDocument;
use App\Services\LegislationSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LegislationController extends Controller
{
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

    /** GET /api/v1/legislation/resolve?act=&key=&language= */
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
            $data['language'] ?? 'en'
        );

        if (! $resolved) {
            return response()->json([
                'message' => 'Referenced provision not found in synced documents.',
                'hint'    => 'Run Legislation Hub sync in admin if this act was recently added.',
            ], 404);
        }

        // Admin custom popup override (manual refs by act + provision key)
        $override = \App\Models\LegislationReference::query()
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
}

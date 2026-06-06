<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IrccCategory;
use App\Models\IrccCategoryDocument;
use App\Models\IrccFormCatalog;
use App\Models\IrccInteractiveForm;
use App\Services\IrccFormsSyncService;
use App\Services\IrccInteractiveFormSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminApplicationPackageController extends Controller
{
    /** GET /api/v1/admin/application-packages/tree */
    public function tree(): JsonResponse
    {
        $roots = IrccCategory::where('level', 1)
            ->orderBy('sort_order')
            ->with([
                'children' => fn ($q) => $q->orderBy('sort_order')
                    ->with([
                        'children' => fn ($q2) => $q2->orderBy('sort_order')
                            ->with(['documents' => fn ($q3) => $q3->orderBy('sort_order')]),
                    ]),
            ])
            ->get();

        return response()->json(['data' => $roots->map(fn ($n) => $this->formatNode($n))]);
    }

    /** GET /api/v1/admin/application-packages/leaves */
    public function leaves(): JsonResponse
    {
        $leaves = IrccCategory::where('level', 3)
            ->orderBy('sort_order')
            ->withCount(['interactiveForms as interactive_form_count' => fn ($q) => $q->where('is_active', true)])
            ->with(['documents' => fn ($q) => $q->orderBy('sort_order'), 'parent.parent'])
            ->get()
            ->map(fn (IrccCategory $leaf) => $this->formatLeaf($leaf));

        return response()->json(['data' => $leaves]);
    }

    /** GET /api/v1/admin/application-packages/{category} */
    public function show(IrccCategory $category): JsonResponse
    {
        $category->load(['documents' => fn ($q) => $q->orderBy('sort_order'), 'parent.parent']);

        return response()->json(['data' => $this->formatLeaf($category)]);
    }

    /** POST /api/v1/admin/application-packages/categories */
    public function storeCategory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'parent_id'  => 'nullable|exists:ircc_categories,id',
            'label'      => 'required|string|max:255',
            'sort_order' => 'nullable|integer|min:0',
            'guide'      => 'nullable|string|max:255',
            'checklist'  => 'nullable|string|max:255',
            'forms'      => 'nullable|array',
            'forms.*'    => 'string|max:100',
        ]);

        $level = 1;
        if (! empty($data['parent_id'])) {
            $parent = IrccCategory::findOrFail($data['parent_id']);
            $level  = min($parent->level + 1, 3);
        }

        $result = null;
        if ($level === 3) {
            $result = [
                'guide'     => $data['guide'] ?? '',
                'checklist' => $data['checklist'] ?? '',
                'forms'     => $data['forms'] ?? [],
            ];
        }

        $category = IrccCategory::create([
            'parent_id'  => $data['parent_id'] ?? null,
            'level'      => $level,
            'label'      => $data['label'],
            'result'     => $result,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        return response()->json([
            'data'    => $this->formatLeaf($category->fresh(['documents', 'parent.parent'])),
            'message' => 'Category created.',
        ], 201);
    }

    /** PUT /api/v1/admin/application-packages/{category} */
    public function updateCategory(Request $request, IrccCategory $category): JsonResponse
    {
        $data = $request->validate([
            'label'      => 'sometimes|required|string|max:255',
            'sort_order' => 'nullable|integer|min:0',
            'guide'      => 'nullable|string|max:255',
            'checklist'  => 'nullable|string|max:255',
            'forms'      => 'nullable|array',
            'forms.*'    => 'string|max:100',
        ]);

        $update = [];
        if (array_key_exists('label', $data))      $update['label']      = $data['label'];
        if (array_key_exists('sort_order', $data)) $update['sort_order'] = $data['sort_order'] ?? 0;

        if ($category->level === 3) {
            $result = $category->result ?? ['guide' => '', 'checklist' => '', 'forms' => []];
            if (array_key_exists('guide', $data))     $result['guide']     = $data['guide'] ?? '';
            if (array_key_exists('checklist', $data)) $result['checklist'] = $data['checklist'] ?? '';
            if (array_key_exists('forms', $data))     $result['forms']     = $data['forms'] ?? [];
            $update['result'] = $result;
        }

        $category->update($update);

        return response()->json([
            'data'    => $this->formatLeaf($category->fresh(['documents', 'parent.parent'])),
            'message' => 'Category updated.',
        ]);
    }

    /** DELETE /api/v1/admin/application-packages/{category} */
    public function destroyCategory(IrccCategory $category): JsonResponse
    {
        foreach ($category->documents as $doc) {
            Storage::disk('public')->delete($doc->file_path);
        }

        $category->delete();

        return response()->json(['message' => 'Category deleted.']);
    }

    /** POST /api/v1/admin/application-packages/{category}/documents */
    public function uploadDocument(Request $request, IrccCategory $category): JsonResponse
    {
        if ($category->level !== 3) {
            return response()->json(['message' => 'Documents can only be uploaded to level-3 application packages.'], 422);
        }

        $data = $request->validate([
            'label'    => 'required|string|max:255',
            'doc_type' => 'nullable|string|in:guide,checklist,form,other',
            'file'     => 'required|file|mimes:pdf,jpg,jpeg,png,webp,doc,docx|max:20480',
        ]);

        $file     = $request->file('file');
        $filename = 'pkg-' . $category->id . '-' . time() . '.' . $file->getClientOriginalExtension();
        $path     = $file->storeAs('application-packages/' . $category->id, $filename, 'public');

        $document = IrccCategoryDocument::create([
            'ircc_category_id'  => $category->id,
            'label'             => $data['label'],
            'doc_type'          => $data['doc_type'] ?? 'other',
            'file_path'         => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type'         => $file->getMimeType(),
            'file_size'         => $file->getSize(),
            'sort_order'        => ($category->documents()->max('sort_order') ?? 0) + 1,
        ]);

        return response()->json([
            'data'    => $this->formatDocument($document),
            'message' => 'Document uploaded.',
        ], 201);
    }

    /** DELETE /api/v1/admin/application-packages/{category}/documents/{document} */
    public function destroyDocument(IrccCategory $category, IrccCategoryDocument $document): JsonResponse
    {
        if ($document->ircc_category_id !== $category->id) {
            abort(404);
        }

        Storage::disk('public')->delete($document->file_path);
        $document->delete();

        return response()->json(['message' => 'Document deleted.']);
    }

    /** POST /api/v1/admin/application-packages/sync-catalog */
    public function syncCatalog(Request $request, IrccFormsSyncService $sync): JsonResponse
    {
        $pdfLimit = (int) $request->input('pdf_limit', 80);
        $pdfLimit = max(10, min(200, $pdfLimit));

        $stats = $sync->syncCatalog($pdfLimit);

        return response()->json([
            'message' => 'IRCC form catalog synced from canada.ca.',
            'stats'   => $stats,
            'catalog_count' => IrccFormCatalog::count(),
        ]);
    }

    /** POST /api/v1/admin/application-packages/sync-all */
    public function syncAll(IrccFormsSyncService $sync, IrccInteractiveFormSyncService $formSync): JsonResponse
    {
        $catalog = $sync->syncCatalog(60);
        $packages = $sync->syncAllPackages();
        $interactiveForms = $formSync->syncAllOnlineOnlyPackages();

        return response()->json([
            'message' => 'Full IRCC sync completed.',
            'catalog' => $catalog,
            'packages' => $packages,
            'interactive_forms' => $interactiveForms,
        ]);
    }

    /** POST /api/v1/admin/application-packages/sync-interactive-forms */
    public function syncInteractiveForms(IrccInteractiveFormSyncService $formSync): JsonResponse
    {
        $stats = $formSync->syncAllOnlineOnlyPackages();

        return response()->json([
            'message' => sprintf(
                'Online-only HTML forms synced for %d package(s): %d created, %d updated, %d unchanged.',
                $stats['packages'],
                $stats['created'],
                $stats['updated'],
                $stats['unchanged']
            ),
            'stats' => $stats,
        ]);
    }

    /** POST /api/v1/admin/application-packages/{category}/sync */
    public function syncOne(IrccCategory $category, IrccFormsSyncService $sync, IrccInteractiveFormSyncService $formSync): JsonResponse
    {
        if ($category->level !== 3) {
            return response()->json(['message' => 'Only level-3 application packages can be synced.'], 422);
        }

        $isOnlineOnly = IrccInteractiveFormSyncService::isOnlineOnlyPackage($category);

        if ($isOnlineOnly) {
            $interactive = $formSync->syncPackageForms($category);

            return response()->json([
                'message' => sprintf(
                    'Online-only package synced: %d HTML form(s) created, %d updated, %d unchanged.',
                    $interactive['created'],
                    $interactive['updated'],
                    $interactive['unchanged']
                ),
                'is_online_only'    => true,
                'stats'             => ['interactive_forms' => $interactive],
                'interactive_forms' => $interactive,
                'data'              => $this->formatLeaf($category->fresh(['documents', 'parent.parent'])),
            ]);
        }

        $sync->syncCatalog(20);
        $stats = $sync->syncPackage($category);

        return response()->json([
            'message' => 'Package synced from canada.ca.',
            'is_online_only' => false,
            'stats'   => $stats,
            'data'    => $this->formatLeaf($category->fresh(['documents', 'parent.parent'])),
        ]);
    }

    /** GET /api/v1/admin/application-packages/sync-status */
    public function syncStatus(IrccInteractiveFormSyncService $formSync): JsonResponse
    {
        $onlineOnly = collect($formSync->onlineOnlyPackages())->map(fn (IrccCategory $p) => [
            'id'                     => $p->id,
            'label'                  => $p->label,
            'breadcrumb'             => $p->breadcrumb(),
            'interactive_form_count' => (int) ($p->active_interactive_form_count ?? 0),
        ])->values();

        return response()->json([
            'catalog_count'           => IrccFormCatalog::count(),
            'catalog_with_pdf'        => IrccFormCatalog::whereNotNull('pdf_url')->count(),
            'auto_documents'          => IrccCategoryDocument::where('auto_synced', true)->count(),
            'last_catalog_fetch'      => IrccFormCatalog::max('last_fetched_at'),
            'source_url'              => IrccFormsSyncService::INDEX_URL,
            'online_only_package_count' => $onlineOnly->count(),
            'interactive_form_count'  => IrccInteractiveForm::where('is_active', true)->count(),
            'online_only_packages'    => $onlineOnly,
        ]);
    }

    private function formatNode(IrccCategory $node): array
    {
        return [
            'id'         => $node->id,
            'parent_id'  => $node->parent_id,
            'level'      => $node->level,
            'label'      => $node->label,
            'result'     => $node->result,
            'sort_order' => $node->sort_order,
            'documents'  => $node->relationLoaded('documents')
                ? $node->documents->map(fn ($d) => $this->formatDocument($d))
                : [],
            'children'   => $node->relationLoaded('children')
                ? $node->children->map(fn ($c) => $this->formatNode($c))
                : [],
        ];
    }

    private function formatLeaf(IrccCategory $leaf): array
    {
        $leaf->loadMissing(['documents', 'parent.parent']);

        return [
            'id'                     => $leaf->id,
            'parent_id'              => $leaf->parent_id,
            'level'                  => $leaf->level,
            'label'                  => $leaf->label,
            'result'                 => $leaf->result,
            'sort_order'             => $leaf->sort_order,
            'breadcrumb'             => $leaf->breadcrumb(),
            'is_online_only'         => IrccInteractiveFormSyncService::isOnlineOnlyPackage($leaf),
            'interactive_form_count' => (int) ($leaf->interactive_form_count ?? $leaf->interactiveForms()->where('is_active', true)->count()),
            'documents'              => $leaf->documents->map(fn ($d) => $this->formatDocument($d)),
        ];
    }

    private function formatDocument(IrccCategoryDocument $doc): array
    {
        return [
            'id'                => $doc->id,
            'label'             => $doc->label,
            'doc_type'          => $doc->doc_type,
            'original_filename' => $doc->original_filename,
            'file_url'          => asset('storage/' . $doc->file_path),
            'mime_type'         => $doc->mime_type,
            'file_size'         => $doc->file_size,
            'sort_order'        => $doc->sort_order,
            'is_active'         => $doc->is_active,
            'auto_synced'       => $doc->auto_synced,
            'source_form_code'  => $doc->source_form_code,
            'source_date_modified' => $doc->source_date_modified,
            'last_synced_at'    => $doc->last_synced_at?->toDateTimeString(),
        ];
    }
}

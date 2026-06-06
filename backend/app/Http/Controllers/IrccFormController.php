<?php

namespace App\Http\Controllers;

use App\Models\IrccCategory;
use Illuminate\Http\JsonResponse;

class IrccFormController extends Controller
{
    /**
     * Return the full 3-level IRCC category tree.
     *
     * Level 1 → Level 2 → Level 3 (leaf, carries result package).
     * A single endpoint keeps the frontend simple — it filters in memory.
     */
    public function tree(): JsonResponse
    {
        $roots = IrccCategory::where('level', 1)
            ->orderBy('sort_order')
            ->with([
                'children' => fn ($q) => $q->orderBy('sort_order')
                    ->with([
                        'children' => fn ($q2) => $q2->orderBy('sort_order')
                            ->with(['documents' => fn ($q3) => $q3->where('is_active', true)->orderBy('sort_order')]),
                    ]),
            ])
            ->get(['id', 'parent_id', 'level', 'label', 'result', 'sort_order'])
            ->map(fn (IrccCategory $node) => $this->formatNode($node));

        return response()->json($roots);
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
                ? $node->documents->map(fn ($d) => [
                    'id'                => $d->id,
                    'label'             => $d->label,
                    'doc_type'          => $d->doc_type,
                    'original_filename' => $d->original_filename,
                    'file_url'          => asset('storage/' . $d->file_path),
                    'mime_type'         => $d->mime_type,
                    'file_size'         => $d->file_size,
                ])
                : [],
            'children'   => $node->relationLoaded('children')
                ? $node->children->map(fn ($c) => $this->formatNode($c))
                : [],
        ];
    }
}

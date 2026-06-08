<?php

namespace App\Http\Controllers;

use App\Models\IrccCategoryDocument;
use App\Models\IrccPackageDocumentSubmission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PackageDocumentSubmissionController extends Controller
{
    /** POST /api/v1/client/package-documents/{document}/submit */
    public function clientSubmit(Request $request, IrccCategoryDocument $document): JsonResponse
    {
        $profile = $request->user()->clientProfile;
        $caseFile = $profile?->caseFile;

        if (! $caseFile?->assigned_ircc_category_id) {
            return response()->json(['message' => 'No application package assigned.'], 403);
        }

        if (! $document->is_active || $document->ircc_category_id !== $caseFile->assigned_ircc_category_id) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        $request->validate([
            'file' => 'required|file|mimes:pdf|max:25600',
        ]);

        $file = $request->file('file');
        $path = sprintf(
            'package-submissions/%d/%d/%s.pdf',
            $caseFile->id,
            $document->id,
            now()->format('Ymd_His')
        );

        Storage::disk('public')->put($path, file_get_contents($file->getRealPath()));

        $existing = IrccPackageDocumentSubmission::where('case_file_id', $caseFile->id)
            ->where('ircc_category_document_id', $document->id)
            ->first();

        if ($existing && Storage::disk('public')->exists($existing->file_path)) {
            Storage::disk('public')->delete($existing->file_path);
        }

        $submission = IrccPackageDocumentSubmission::updateOrCreate(
            [
                'case_file_id'              => $caseFile->id,
                'ircc_category_document_id' => $document->id,
            ],
            [
                'uploaded_by'       => $request->user()->id,
                'file_path'         => $path,
                'original_filename' => $file->getClientOriginalName() ?: ($document->label . '.pdf'),
                'mime_type'         => 'application/pdf',
                'file_size'         => $file->getSize(),
                'status'            => 'submitted',
                'submitted_at'      => now(),
            ]
        );

        return response()->json([
            'message'    => 'Form submitted to your consultant.',
            'submission' => $this->formatSubmission($submission),
        ]);
    }

    /** @return array<string, mixed> */
    public static function formatSubmission(IrccPackageDocumentSubmission $submission): array
    {
        return [
            'id'                => $submission->id,
            'status'            => $submission->status,
            'submitted_at'      => $submission->submitted_at,
            'original_filename' => $submission->original_filename,
            'file_size'         => $submission->file_size,
        ];
    }
}

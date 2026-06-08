<?php

namespace App\Http\Controllers;

use App\Models\IrccCategory;
use App\Models\IrccInteractiveForm;
use App\Models\IrccInteractiveFormResponse;
use App\Models\IrccPackageDocumentSubmission;
use App\Support\IrccInteractiveFormSchema;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Schema;

class ApplicationPackageController extends Controller
{
    /** Format an IRCC category leaf with documents for API responses. */
    public static function formatPackage(?IrccCategory $category, ?int $caseFileId = null): ?array
    {
        if (! $category) {
            return null;
        }

        $category->loadMissing([
            'documents' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order'),
            'interactiveForms' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order'),
            'parent.parent',
        ]);

        $responses = collect();
        $packageSubmissions = collect();
        if ($caseFileId) {
            $responses = IrccInteractiveFormResponse::where('case_file_id', $caseFileId)
                ->get()
                ->keyBy('ircc_interactive_form_id');
            if (Schema::connection('cws')->hasTable('ircc_package_document_submissions')) {
                $packageSubmissions = IrccPackageDocumentSubmission::where('case_file_id', $caseFileId)
                    ->get()
                    ->keyBy('ircc_category_document_id');
            }
        }

        return [
            'id'         => $category->id,
            'label'      => $category->label,
            'breadcrumb' => $category->breadcrumb(),
            'result'     => $category->result,
            'documents'  => $category->documents->map(function ($doc) use ($packageSubmissions) {
                $submission = $packageSubmissions->get($doc->id);

                return [
                    'id'                => $doc->id,
                    'label'             => $doc->label,
                    'doc_type'          => $doc->doc_type,
                    'original_filename' => $doc->original_filename,
                    'file_url'          => asset('storage/' . $doc->file_path),
                    'mime_type'         => $doc->mime_type,
                    'file_size'         => $doc->file_size,
                    'submission'        => $submission
                        ? PackageDocumentSubmissionController::formatSubmission($submission)
                        : null,
                ];
            })->values(),
            'interactive_forms' => $category->interactiveForms->map(
                fn (IrccInteractiveForm $form) => IrccInteractiveFormSchema::formatFormSummary(
                    $form,
                    $responses->get($form->id)
                )
            )->values(),
        ];
    }

    /** GET /api/v1/client/application-package */
    public function clientShow(\Illuminate\Http\Request $request): JsonResponse
    {
        $profile = $request->user()->clientProfile;

        if (! $profile?->caseFile?->assigned_ircc_category_id) {
            return response()->json(['application_package' => null]);
        }

        $caseFile = $profile->caseFile;

        $category = IrccCategory::with([
            'documents' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order'),
            'interactiveForms' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order'),
            'parent.parent',
        ])->find($caseFile->assigned_ircc_category_id);

        return response()->json([
            'application_package' => self::formatPackage($category, $caseFile->id),
            'assigned_at'         => $caseFile->application_package_assigned_at,
        ]);
    }
}


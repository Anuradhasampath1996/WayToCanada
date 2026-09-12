<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Models\CaseFile;
use App\Models\DocumentSubmission;
use App\Models\IrccCategoryDocument;
use App\Models\IrccPackageDocumentSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SecurePdfController extends Controller
{
    /** GET /api/v1/client/package-documents/{document}/stream */
    public function clientPackageDocument(Request $request, IrccCategoryDocument $document): StreamedResponse
    {
        $profile = $request->user()->clientProfile;
        $caseFile = $profile?->caseFile;

        if (! $caseFile?->assigned_ircc_category_id) {
            abort(403, 'No application package assigned.');
        }

        if (! $document->is_active || $document->ircc_category_id !== $caseFile->assigned_ircc_category_id) {
            abort(404);
        }

        return $this->streamPublicDiskFile(
            $document->file_path,
            $document->original_filename ?: ($document->label.'.pdf'),
            $request->boolean('download'),
        );
    }

    /** GET /api/v1/client/package-documents/{document}/submission/stream */
    public function clientPackageDocumentSubmission(Request $request, IrccCategoryDocument $document): StreamedResponse
    {
        $profile = $request->user()->clientProfile;
        $caseFile = $profile?->caseFile;

        if (! $caseFile?->assigned_ircc_category_id) {
            abort(403, 'No application package assigned.');
        }

        if (! $document->is_active || $document->ircc_category_id !== $caseFile->assigned_ircc_category_id) {
            abort(404);
        }

        $submission = IrccPackageDocumentSubmission::where('case_file_id', $caseFile->id)
            ->where('ircc_category_document_id', $document->id)
            ->whereNotNull('submitted_at')
            ->first();

        if (! $submission || ! Storage::disk('public')->exists($submission->file_path)) {
            abort(404, 'Submitted form not found.');
        }

        return $this->streamPublicDiskFile(
            $submission->file_path,
            $submission->original_filename ?: ($document->label.'-submitted.pdf'),
            $request->boolean('download'),
        );
    }

    /** GET /api/v1/consultant/clients/{profile}/package-documents/{document}/stream */
    public function consultantPackageDocument(Request $request, ClientProfile $profile, IrccCategoryDocument $document): StreamedResponse
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        $caseFile = $profile->caseFile;

        if (! $caseFile?->assigned_ircc_category_id) {
            abort(403, 'No application package assigned.');
        }

        if (! $document->is_active || $document->ircc_category_id !== $caseFile->assigned_ircc_category_id) {
            abort(404);
        }

        return $this->streamPublicDiskFile(
            $document->file_path,
            $document->original_filename ?: ($document->label.'.pdf'),
            $request->boolean('download'),
        );
    }

    /** GET /api/v1/client/documents/{submission}/stream */
    public function clientSubmission(Request $request, DocumentSubmission $submission): StreamedResponse
    {
        $profile = $request->user()->clientProfile;

        if (! $profile?->caseFile || $submission->case_file_id !== $profile->caseFile->id) {
            abort(403, 'Access denied.');
        }

        return $this->streamPublicDiskFile(
            $submission->file_path,
            $submission->original_filename,
            $request->boolean('download'),
        );
    }

    /** GET /api/v1/consultant/clients/{profile}/documents/{submission}/stream */
    public function consultantSubmission(Request $request, ClientProfile $profile, DocumentSubmission $submission): StreamedResponse
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        $ownsCase = CaseFile::where('client_profile_id', $profile->id)
            ->where('id', $submission->case_file_id)
            ->exists();

        if (! $ownsCase) {
            abort(403, 'Access denied.');
        }

        return $this->streamPublicDiskFile(
            $submission->file_path,
            $submission->original_filename,
            $request->boolean('download'),
        );
    }

    /** GET /api/v1/consultant/clients/{profile}/package-document-submissions/{submission}/stream */
    public function consultantPackageSubmission(
        Request $request,
        ClientProfile $profile,
        IrccPackageDocumentSubmission $submission,
    ): StreamedResponse {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        $ownsCase = CaseFile::where('client_profile_id', $profile->id)
            ->where('id', $submission->case_file_id)
            ->exists();

        if (! $ownsCase) {
            abort(403, 'Access denied.');
        }

        $disk = $submission->isPrivateStorage() ? 'local' : 'public';
        if (! Storage::disk($disk)->exists($submission->file_path)) {
            // Fall back — older package uploads live on public.
            $disk = 'public';
            if (! Storage::disk($disk)->exists($submission->file_path)) {
                abort(404, 'File not found.');
            }
        }

        $filename = $submission->original_filename ?: 'document.pdf';
        $mime = Storage::disk($disk)->mimeType($submission->file_path) ?: 'application/pdf';
        $disposition = ($request->boolean('download') ? 'attachment' : 'inline')
            .'; filename="'.addslashes($filename).'"';

        return Storage::disk($disk)->response($submission->file_path, $filename, [
            'Content-Type'        => $mime,
            'Content-Disposition' => $disposition,
            'Cache-Control'       => 'private, max-age=3600',
        ]);
    }

    private function streamPublicDiskFile(string $filePath, string $filename, bool $download): StreamedResponse
    {
        if (! Storage::disk('public')->exists($filePath)) {
            abort(404, 'File not found.');
        }

        $mime = Storage::disk('public')->mimeType($filePath) ?: 'application/pdf';
        $disposition = ($download ? 'attachment' : 'inline').'; filename="'.addslashes($filename).'"';

        return Storage::disk('public')->response($filePath, $filename, [
            'Content-Type'        => $mime,
            'Content-Disposition' => $disposition,
            'Cache-Control'       => 'private, max-age=3600',
        ]);
    }
}

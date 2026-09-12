<?php

namespace App\Http\Controllers;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\DocumentSubmission;
use App\Models\IrccPackageDocumentSubmission;
use App\Services\CaseFileLifecycleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ConsultantDocumentWorkshopController extends Controller
{
    private const USABLE_MIMES = [
        'application/pdf',
        'application/x-pdf',
        'application/octet-stream',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
    ];

    private const USABLE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

    /**
     * GET /api/v1/consultant/clients/{profile}/document-workshop/sources
     */
    public function sources(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $caseFile = $this->resolveCaseFile($profile, (int) $request->user()->id);
        $caseIds = CaseFile::where('client_profile_id', $profile->id)->pluck('id');

        if ($caseIds->isEmpty()) {
            return response()->json([
                'client' => $this->clientMeta($profile),
                'case_file_id' => null,
                'documents' => [],
            ]);
        }

        $caseDocs = DocumentSubmission::query()
            ->whereIn('case_file_id', $caseIds)
            ->orderByDesc('created_at')
            ->get()
            ->filter(fn (DocumentSubmission $d) => $this->isUsableUpload(
                $d->mime_type,
                $d->original_filename
            ))
            ->values()
            ->map(fn (DocumentSubmission $d) => [
                'id' => $d->id,
                'source_kind' => 'case_document',
                'document_type' => $d->document_type,
                'document_label' => $d->document_label ?: $d->original_filename,
                'original_filename' => $d->original_filename,
                'mime_type' => $d->mime_type,
                'file_size' => $d->file_size,
                'status' => $d->status,
                'uploaded_at' => $d->created_at?->toIso8601String(),
                'case_file_id' => $d->case_file_id,
                'stream_url' => url(sprintf(
                    '/api/v1/consultant/clients/%d/documents/%d/stream',
                    $profile->id,
                    $d->id
                )),
                'is_image' => $this->isImage($d->mime_type, $d->original_filename),
                'is_pdf' => $this->isPdf($d->mime_type, $d->original_filename),
            ]);

        $packageDocs = IrccPackageDocumentSubmission::query()
            ->whereIn('case_file_id', $caseIds)
            ->whereNotNull('file_path')
            ->whereNotNull('ircc_category_document_id')
            ->where(function ($q) {
                $q->whereNotNull('submitted_at')
                    ->orWhere('file_path', 'like', 'package-submissions/%');
            })
            ->with(['document:id,label'])
            ->orderByDesc('created_at')
            ->get()
            ->filter(fn (IrccPackageDocumentSubmission $d) => $this->isUsableUpload(
                $d->mime_type,
                $d->original_filename ?: ($d->document?->label.'.pdf')
            ))
            ->values()
            ->map(fn (IrccPackageDocumentSubmission $d) => [
                'id' => $d->id,
                'source_kind' => 'package_submission',
                'document_type' => 'package_form',
                'document_label' => $d->document?->label
                    ?: ($d->original_filename ?: 'Package form'),
                'original_filename' => $d->original_filename ?: 'form.pdf',
                'mime_type' => $d->mime_type ?: 'application/pdf',
                'file_size' => $d->file_size,
                'status' => $d->status,
                'uploaded_at' => ($d->submitted_at ?? $d->created_at)?->toIso8601String(),
                'case_file_id' => $d->case_file_id,
                'stream_url' => url(sprintf(
                    '/api/v1/consultant/clients/%d/package-document-submissions/%d/stream',
                    $profile->id,
                    $d->id
                )),
                'is_image' => false,
                'is_pdf' => true,
            ]);

        $documents = $caseDocs
            ->concat($packageDocs)
            ->sortByDesc(fn (array $d) => $d['uploaded_at'] ?? '')
            ->values()
            ->all();

        return response()->json([
            'client' => $this->clientMeta($profile),
            'case_file_id' => $caseFile?->id,
            'documents' => $documents,
        ]);
    }

    /**
     * POST /api/v1/consultant/clients/{profile}/document-workshop/save
     * Multipart: file (PDF), document_name, description?
     */
    public function save(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'file' => 'required|file|mimes:pdf|max:51200',
            'document_name' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
        ]);

        $caseFile = $this->resolveCaseFile($profile, (int) $request->user()->id);
        if (! $caseFile) {
            return response()->json(['message' => 'No active case file found.'], 404);
        }

        $file = $request->file('file');
        $safeName = Str::slug(pathinfo($data['document_name'], PATHINFO_FILENAME)) ?: 'document-workshop';
        $filename = sprintf(
            'workshop-%s-%s-%d.pdf',
            $caseFile->id,
            $safeName,
            time()
        );
        $path = $file->storeAs('case-documents', $filename, 'public');

        $label = trim($data['document_name']);
        if (! empty($data['description'])) {
            $label = $label.' — '.Str::limit(trim($data['description']), 80, '…');
        }

        $submission = DocumentSubmission::create([
            'case_file_id' => $caseFile->id,
            'uploaded_by' => $request->user()->id,
            'document_type' => 'workshop_package',
            'document_label' => $label,
            'file_path' => $path,
            'original_filename' => $safeName.'.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => $file->getSize(),
            'status' => 'consultant_approved',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Document Workshop PDF saved to the case.',
            'document' => [
                'id' => $submission->id,
                'document_type' => $submission->document_type,
                'document_label' => $submission->document_label,
                'original_filename' => $submission->original_filename,
                'mime_type' => $submission->mime_type,
                'file_size' => $submission->file_size,
                'status' => $submission->status,
                'stream_url' => url(sprintf(
                    '/api/v1/consultant/clients/%d/documents/%d/stream',
                    $profile->id,
                    $submission->id
                )),
            ],
        ], 201);
    }

    private function resolveCaseFile(ClientProfile $profile, int $consultantId): ?CaseFile
    {
        $resolved = app(CaseFileLifecycleService::class)
            ->resolveActiveCaseFile($profile, $consultantId, createIfMissing: false);

        if ($resolved) {
            return $resolved;
        }

        // Match Case Hub fallback: any case for this client.
        return CaseFile::where('client_profile_id', $profile->id)->orderBy('id')->first();
    }

    private function isUsableUpload(?string $mime, ?string $filename): bool
    {
        $mime = strtolower(trim((string) $mime));
        $ext = strtolower(pathinfo((string) $filename, PATHINFO_EXTENSION));

        if ($ext !== '' && in_array($ext, self::USABLE_EXTENSIONS, true)) {
            return true;
        }

        return in_array($mime, self::USABLE_MIMES, true);
    }

    private function isImage(?string $mime, ?string $filename): bool
    {
        $mime = strtolower((string) $mime);
        if (str_starts_with($mime, 'image/')) {
            return true;
        }
        $ext = strtolower(pathinfo((string) $filename, PATHINFO_EXTENSION));

        return in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true);
    }

    private function isPdf(?string $mime, ?string $filename): bool
    {
        $mime = strtolower((string) $mime);
        if (in_array($mime, ['application/pdf', 'application/x-pdf'], true)) {
            return true;
        }

        return str_ends_with(strtolower((string) $filename), '.pdf');
    }

    private function authorizeConsultant(Request $request, ClientProfile $profile): void
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }
    }

    /** @return array{id: int, name: string|null, email: string|null} */
    private function clientMeta(ClientProfile $profile): array
    {
        $profile->loadMissing('user:id,name,email');

        return [
            'id' => $profile->id,
            'name' => $profile->user?->name,
            'email' => $profile->user?->email,
        ];
    }
}

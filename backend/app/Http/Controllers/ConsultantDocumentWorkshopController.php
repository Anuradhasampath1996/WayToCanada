<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Models\DocumentSubmission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ConsultantDocumentWorkshopController extends Controller
{
    private const USABLE_MIMES = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
    ];

    /**
     * GET /api/v1/consultant/clients/{profile}/document-workshop/sources
     */
    public function sources(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $caseFile = $profile->caseFile;
        if (! $caseFile) {
            return response()->json([
                'client' => $this->clientMeta($profile),
                'case_file_id' => null,
                'documents' => [],
            ]);
        }

        $documents = $caseFile->documentSubmissions()
            ->orderByDesc('created_at')
            ->get()
            ->filter(function (DocumentSubmission $d) {
                $mime = strtolower((string) $d->mime_type);

                return in_array($mime, self::USABLE_MIMES, true)
                    || str_ends_with(strtolower((string) $d->original_filename), '.pdf')
                    || str_ends_with(strtolower((string) $d->original_filename), '.jpg')
                    || str_ends_with(strtolower((string) $d->original_filename), '.jpeg')
                    || str_ends_with(strtolower((string) $d->original_filename), '.png')
                    || str_ends_with(strtolower((string) $d->original_filename), '.webp');
            })
            ->values()
            ->map(fn (DocumentSubmission $d) => [
                'id' => $d->id,
                'document_type' => $d->document_type,
                'document_label' => $d->document_label,
                'original_filename' => $d->original_filename,
                'mime_type' => $d->mime_type,
                'file_size' => $d->file_size,
                'status' => $d->status,
                'uploaded_at' => $d->created_at?->toIso8601String(),
                'stream_url' => url(sprintf(
                    '/api/v1/consultant/clients/%d/documents/%d/stream',
                    $profile->id,
                    $d->id
                )),
                'is_image' => str_starts_with(strtolower((string) $d->mime_type), 'image/'),
                'is_pdf' => strtolower((string) $d->mime_type) === 'application/pdf'
                    || str_ends_with(strtolower((string) $d->original_filename), '.pdf'),
            ]);

        return response()->json([
            'client' => $this->clientMeta($profile),
            'case_file_id' => $caseFile->id,
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

        $caseFile = $profile->caseFile;
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

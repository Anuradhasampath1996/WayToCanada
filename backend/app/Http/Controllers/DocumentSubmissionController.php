<?php

namespace App\Http\Controllers;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\DocumentSubmission;
use App\Models\CaseMessage;
use App\Services\CaseManagementHubService;
use App\Services\IrccInteractiveFormVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DocumentSubmissionController extends Controller
{
    public function __construct(
        private IrccInteractiveFormVerificationService $verificationService,
        private CaseManagementHubService $hubService,
    ) {}
    // ─────────────────────────────────────────────────────────────────────────
    // CLIENT ENDPOINTS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/client/documents
     * Returns all document submissions for the authenticated client.
     */
    public function clientIndex(Request $request): JsonResponse
    {
        $user    = $request->user();
        $profile = $user->clientProfile;

        if (! $profile || ! $profile->caseFile) {
            return response()->json(['documents' => []]);
        }

        $submissions = $profile->caseFile
            ->documentSubmissions()
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($d) => $this->formatDoc($d));

        return response()->json(['documents' => $submissions]);
    }

    /**
     * POST /api/v1/client/documents/upload
     * Client uploads a document for a specific document_type.
     */
    public function clientUpload(Request $request): JsonResponse
    {
        $request->validate([
            'document_type'  => 'required|string|max:100',
            'document_label' => 'required|string|max:255',
            'file'           => 'required|file|mimes:jpg,jpeg,png,pdf,webp|max:20480',
        ]);

        $user    = $request->user();
        $profile = $user->clientProfile;

        if (! $profile || ! $profile->caseFile) {
            return response()->json(['message' => 'No active case file found.'], 404);
        }

        $caseFile = $profile->caseFile;

        // Ensure agreement is signed before uploading
        if (! in_array($caseFile->status, [
            'AGREEMENT_SIGNED', 'DOCUMENTS_UPLOADING', 'UNDER_REVIEW',
            'READY_FOR_SUBMISSION', 'APPLICATION_SUBMITTED',
        ])) {
            return response()->json(['message' => 'Agreement must be signed before uploading documents.'], 403);
        }

        if (! $this->verificationService->isCaseManagementUnlocked($caseFile)) {
            return response()->json([
                'message' => 'Document uploads unlock after your consultant reviews all application forms.',
            ], 403);
        }

        $file         = $request->file('file');
        $documentType = $request->input('document_type');
        $token        = $caseFile->agreement_token ?? $caseFile->id;
        $filename     = "doc-{$token}-{$documentType}-" . time() . '.' . $file->getClientOriginalExtension();
        $path         = $file->storeAs('case-documents', $filename, 'public');

        // Create the submission record
        $submission = DocumentSubmission::create([
            'case_file_id'    => $caseFile->id,
            'uploaded_by'     => $user->id,
            'document_type'   => $documentType,
            'document_label'  => $request->input('document_label'),
            'file_path'       => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type'       => $file->getMimeType(),
            'file_size'       => $file->getSize(),
            'status'          => 'pending_review',
        ]);

        // Advance case status to DOCUMENTS_UPLOADING if still at AGREEMENT_SIGNED
        if ($caseFile->status === 'AGREEMENT_SIGNED') {
            $caseFile->update(['status' => 'DOCUMENTS_UPLOADING']);
        }

        // Trigger async AI verification (non-blocking — log failure, don't break upload)
        $this->triggerAiVerification($submission, $caseFile, $file);

        return response()->json([
            'message'  => 'Document uploaded successfully.',
            'document' => $this->formatDoc($submission->fresh()),
        ], 201);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONSULTANT ENDPOINTS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/consultant/clients/{profile}/documents
     * Returns all document submissions for a specific client.
     */
    public function consultantIndex(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $caseFile = $profile->caseFile;
        if (! $caseFile) {
            return response()->json(['documents' => []]);
        }

        $submissions = $caseFile
            ->documentSubmissions()
            ->with(['uploader:id,name', 'reviewer:id,name'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($d) => $this->formatDoc($d, includeReviewer: true));

        return response()->json(['documents' => $submissions]);
    }

    /**
     * PATCH /api/v1/consultant/clients/{profile}/documents/{submission}/review
     * Consultant approves or rejects a document submission.
     */
    public function review(Request $request, ClientProfile $profile, DocumentSubmission $submission): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        // Ensure submission belongs to this client's case file
        if ($submission->case_file_id !== $profile->caseFile?->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $request->validate([
            'action'             => 'required|in:approve,reject',
            'rejection_comment'  => 'nullable|string|max:1000',
        ]);

        $action = $request->input('action');
        $status = $action === 'approve' ? 'consultant_approved' : 'consultant_rejected';

        $submission->update([
            'status'             => $status,
            'rejection_comment'  => $action === 'reject' ? $request->input('rejection_comment') : null,
            'reviewed_by'        => $request->user()->id,
            'reviewed_at'        => now(),
        ]);

        // If rejected, create a system message so client can see the comment
        if ($action === 'reject' && $request->filled('rejection_comment')) {
            CaseMessage::create([
                'case_file_id'           => $submission->case_file_id,
                'sender_id'              => $request->user()->id,
                'sender_type'            => 'consultant',
                'message'                => "Document \"{$submission->document_label}\" was rejected: " . $request->input('rejection_comment'),
                'document_submission_id' => $submission->id,
            ]);
        }

        $caseFile = $profile->caseFile;
        if ($caseFile) {
            $this->hubService->syncPipelineStatus($caseFile->fresh());
        }

        return response()->json([
            'message'  => $action === 'approve' ? 'Document approved.' : 'Document rejected.',
            'document' => $this->formatDoc($submission->fresh()),
            'case_file' => $caseFile ? ['status' => $caseFile->fresh()->status] : null,
        ]);
    }

    /**
     * PATCH /api/v1/consultant/clients/{profile}/case-pipeline
     * Update the Kanban pipeline status for a client's case.
     */
    public function updatePipelineStatus(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $request->validate([
            'status' => 'required|in:AGREEMENT_SIGNED,DOCUMENTS_UPLOADING,UNDER_REVIEW,READY_FOR_SUBMISSION,APPLICATION_SUBMITTED',
        ]);

        $caseFile = $profile->caseFile;
        if (! $caseFile) {
            return response()->json(['message' => 'No case file found.'], 404);
        }

        $caseFile->update(['status' => $request->input('status')]);

        return response()->json([
            'message'   => 'Pipeline status updated.',
            'case_file' => ['id' => $caseFile->id, 'status' => $caseFile->status],
        ]);
    }

    /**
     * GET /api/v1/consultant/case-pipeline
     * Returns all clients with their current pipeline status (for Kanban board).
     */
    public function pipeline(Request $request): JsonResponse
    {
        $consultant = $request->user();

        $profiles = ClientProfile::where('consultant_id', $consultant->id)
            ->with([
                'user:id,name,email',
                'caseFile:id,client_profile_id,status,immigration_pathway,agreement_signed_at',
            ])
            ->get();

        $kanban = [];

        foreach ($profiles as $profile) {
            $cf = $profile->caseFile;
            if (! $cf) continue;

            // Only show clients who have signed the agreement
            $order = CaseFile::statusOrder();
            if (($order[$cf->status] ?? 0) < 3) continue;

            $pendingDocs = $cf->documentSubmissions()
                ->whereIn('status', ['pending_review', 'under_ai_review', 'ai_flagged'])
                ->count();

            $kanban[] = [
                'profile_id'         => $profile->id,
                'client_name'        => $profile->user->name ?? 'Unknown',
                'client_email'       => $profile->user->email ?? '',
                'status'             => $cf->status,
                'immigration_pathway'=> $cf->immigration_pathway,
                'agreement_signed_at'=> $cf->agreement_signed_at?->toDateTimeString(),
                'pending_docs'       => $pendingDocs,
                'case_file_id'       => $cf->id,
            ];
        }

        return response()->json(['pipeline' => $kanban]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private function authorizeConsultant(Request $request, ClientProfile $profile): void
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }
    }

    private function formatDoc(DocumentSubmission $d, bool $includeReviewer = false): array
    {
        $data = [
            'id'                => $d->id,
            'document_type'     => $d->document_type,
            'document_label'    => $d->document_label,
            'original_filename' => $d->original_filename,
            'file_url'          => asset('storage/' . $d->file_path),
            'mime_type'         => $d->mime_type,
            'file_size'         => $d->file_size,
            'status'            => $d->status,
            'ai_confidence'     => $d->ai_confidence,
            'ai_match_result'   => $d->ai_match_result,
            'rejection_comment' => $d->rejection_comment,
            'uploaded_at'       => $d->created_at?->toDateTimeString(),
        ];

        if ($includeReviewer) {
            $data['reviewed_by']   = $d->reviewer?->name;
            $data['reviewed_at']   = $d->reviewed_at?->toDateTimeString();
            $data['ai_result']     = $d->ai_result;
        }

        return $data;
    }

    /**
     * Send the uploaded file to the AI OCR service and update the submission
     * with the verification result. Errors are logged but never bubble up to
     * the client (upload already succeeded).
     */
    private function triggerAiVerification(
        DocumentSubmission $submission,
        CaseFile $caseFile,
        \Illuminate\Http\UploadedFile $file
    ): void {
        // Only image/PDF documents that the OCR service can handle
        $scannable = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (! in_array($submission->mime_type, $scannable)) {
            // PDFs not supported by OCR classifier — mark as pending for consultant review
            return;
        }

        $submission->update(['status' => 'under_ai_review']);

        $serviceUrl = rtrim(config('services.ocr.url'), '/') . '/scan-document';

        try {
            $response = Http::timeout(60)
                ->attach('file', file_get_contents($file->getRealPath()), $file->getClientOriginalName(), ['Content-Type' => $file->getMimeType()])
                ->post($serviceUrl);

            if ($response->failed()) {
                Log::warning('[DocAI] OCR service returned error for doc #' . $submission->id, ['status' => $response->status()]);
                $submission->update(['status' => 'pending_review']);
                return;
            }

            $aiData = $response->json();

            // Compare AI extracted name with questionnaire data
            $matchResult = $this->matchAiDataToQuestionnaire($aiData, $caseFile);

            $submission->update([
                'status'           => $matchResult['matched'] ? 'ai_verified' : 'ai_flagged',
                'ai_result'        => $aiData,
                'ai_confidence'    => $aiData['confidence_score'] ?? null,
                'ai_match_result'  => $matchResult,
            ]);

        } catch (\Throwable $e) {
            Log::error('[DocAI] Exception during AI verification for doc #' . $submission->id, ['error' => $e->getMessage()]);
            $submission->update(['status' => 'pending_review']);
        }
    }

    /**
     * Compare AI-extracted data against the questionnaire submission for the
     * same case file. Returns an array with 'matched' bool and 'details'.
     */
    private function matchAiDataToQuestionnaire(array $aiData, CaseFile $caseFile): array
    {
        $extracted = $aiData['extracted_data'] ?? [];
        if (empty($extracted)) {
            return ['matched' => false, 'reason' => 'No data extracted by AI.'];
        }

        // Load questionnaire data via the client's user account
        $clientUserId  = $caseFile->clientProfile?->user_id;
        $questionnaire = $clientUserId
            ? \App\Models\QuestionnaireSubmission::where('user_id', $clientUserId)->first()
            : null;

        if (! $questionnaire) {
            return ['matched' => true, 'reason' => 'No questionnaire data to compare — auto-approved.'];
        }

        $mainData  = $questionnaire->main_data ?? [];
        $details   = [];
        $allMatch  = true;

        // Compare full name (best-effort, case-insensitive)
        if (! empty($extracted['full_name'])) {
            $aiName    = strtolower(trim($extracted['full_name']));
            $qFirstName = strtolower(trim($mainData['first_name'] ?? ''));
            $qLastName  = strtolower(trim($mainData['last_name'] ?? ''));
            $qFullName  = trim("$qFirstName $qLastName");
            $nameMatch  = $qFullName && (
                str_contains($aiName, $qFirstName) || str_contains($aiName, $qLastName)
            );
            $details['name'] = ['ai' => $extracted['full_name'], 'questionnaire' => $qFullName ?: null, 'match' => $nameMatch];
            if (! $nameMatch && $qFullName) $allMatch = false;
        }

        // Compare date of birth
        if (! empty($extracted['date_of_birth'])) {
            $aiDob    = $extracted['date_of_birth'];
            $qDob     = $mainData['date_of_birth'] ?? '';
            $dobMatch = $qDob && $aiDob === $qDob;
            $details['dob'] = ['ai' => $aiDob, 'questionnaire' => $qDob ?: null, 'match' => $dobMatch];
            if (! $dobMatch && $qDob) $allMatch = false;
        }

        return [
            'matched' => $allMatch,
            'details' => $details,
            'reason'  => $allMatch ? 'All fields matched.' : 'One or more fields did not match questionnaire data.',
        ];
    }
}

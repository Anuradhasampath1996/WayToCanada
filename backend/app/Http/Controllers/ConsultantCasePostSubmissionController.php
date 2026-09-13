<?php

namespace App\Http\Controllers;

use App\Models\CaseGovernmentRequest;
use App\Models\ClientProfile;
use App\Services\CaseClosureReviewService;
use App\Services\CaseDecisionService;
use App\Services\CaseFileLifecycleService;
use App\Services\CaseGovernmentRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantCasePostSubmissionController extends Controller
{
    public function __construct(
        private CaseGovernmentRequestService $requests,
        private CaseDecisionService $decisions,
        private CaseClosureReviewService $closure,
        private CaseFileLifecycleService $lifecycle,
    ) {}

    public function show(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->owned($request, $profile);

        return response()->json([
            'government_requests' => $this->requests->serialize($caseFile),
            'decision' => $this->decisions->serialize($caseFile),
            'closure' => $this->closure->serialize($caseFile),
        ]);
    }

    public function storeRequest(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->owned($request, $profile);
        $data = $request->validate([
            'type' => 'required|in:aor,biometrics,medical,additional_documents,interview,pfl,passport_request,portal_invitation,other',
            'custom_label' => 'nullable|string|max:255',
            'due_at' => 'nullable|date',
            'notes' => 'nullable|string|max:2000',
        ]);

        try {
            $created = $this->requests->create($caseFile, $request->user(), $data);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'government_requests' => $this->requests->serialize($caseFile->fresh()),
            'request' => $this->requests->serializeOne($created),
            'message' => 'Government request recorded and the client was notified.',
        ], 201);
    }

    public function markRequestInProgress(Request $request, ClientProfile $profile, CaseGovernmentRequest $governmentRequest): JsonResponse
    {
        $caseFile = $this->owned($request, $profile);
        $this->assertBelongs($caseFile, $governmentRequest);

        try {
            $this->requests->markResponseInProgress($governmentRequest, $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'government_requests' => $this->requests->serialize($caseFile->fresh()),
        ]);
    }

    public function markRequestAnswered(Request $request, ClientProfile $profile, CaseGovernmentRequest $governmentRequest): JsonResponse
    {
        $caseFile = $this->owned($request, $profile);
        $this->assertBelongs($caseFile, $governmentRequest);
        $data = $request->validate([
            'notes' => 'nullable|string|max:2000',
        ]);

        try {
            $this->requests->markAnswered($governmentRequest, $request->user(), $data['notes'] ?? null);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'government_requests' => $this->requests->serialize($caseFile->fresh()),
            'message' => 'Government request marked answered.',
        ]);
    }

    public function recordDecision(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->owned($request, $profile);
        $data = $request->validate([
            'decision_status' => 'required|in:approved,refused,withdrawn,other',
            'decision_note' => 'nullable|required_if:decision_status,other|string|max:2000',
            'next_step_note' => 'nullable|string|max:2000',
            'letter' => 'nullable|file|max:10240',
        ]);

        try {
            $caseFile = $this->decisions->record($caseFile, $request->user(), $data, $request->file('letter'));
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'decision' => $this->decisions->serialize($caseFile),
            'message' => 'Decision recorded.',
        ]);
    }

    public function saveClosureChecklist(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->owned($request, $profile);
        $data = $request->validate([
            'items' => 'required|array',
            'items.*' => 'boolean',
        ]);

        $caseFile = $this->closure->saveChecklist($caseFile, $request->user(), $data['items']);

        return response()->json([
            'closure' => $this->closure->serialize($caseFile),
        ]);
    }

    public function closeCase(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->owned($request, $profile);
        $data = $request->validate([
            'action' => 'nullable|in:close,complete',
            'note' => 'nullable|string|max:2000',
        ]);

        try {
            $caseFile = $this->closure->close(
                $caseFile,
                $request->user(),
                $data['action'] ?? 'close',
                $data['note'] ?? null,
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'closure' => $this->closure->serialize($caseFile),
            'message' => 'Case closed after closure review.',
        ]);
    }

    private function owned(Request $request, ClientProfile $profile): \App\Models\CaseFile
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        $caseFile = $this->lifecycle->resolveActiveCaseFile($profile, $request->user()->id, createIfMissing: false);
        if (! $caseFile) {
            abort(404, 'No case file found.');
        }

        return $caseFile;
    }

    private function assertBelongs(\App\Models\CaseFile $caseFile, CaseGovernmentRequest $request): void
    {
        if ((int) $request->case_file_id !== (int) $caseFile->id) {
            abort(404, 'Not found.');
        }
    }
}

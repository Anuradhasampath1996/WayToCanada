<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Services\CaseFileLifecycleService;
use App\Services\CaseFinalReviewService;
use App\Services\CaseSubmissionConfirmationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantCaseFinalReviewController extends Controller
{
    public function __construct(
        private CaseFinalReviewService $review,
        private CaseSubmissionConfirmationService $submission,
        private CaseFileLifecycleService $lifecycle,
    ) {}

    public function show(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->owned($request, $profile);

        return response()->json([
            'final_review' => $this->review->serialize($caseFile, forClient: false),
            'submission' => $this->submission->serialize($caseFile),
        ]);
    }

    public function saveChecklist(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->owned($request, $profile);
        $data = $request->validate([
            'items' => 'required|array',
            'items.*' => 'boolean',
            'notes' => 'nullable|string|max:4000',
        ]);

        try {
            $caseFile = $this->review->saveChecklist(
                $caseFile,
                $request->user(),
                $data['items'],
                $data['notes'] ?? null,
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'final_review' => $this->review->serialize($caseFile, forClient: false),
            'message' => 'Checklist saved. Highlights remain support only and do not approve the file.',
        ]);
    }

    public function markReadyForClient(Request $request, ClientProfile $profile): JsonResponse
    {
        app(\App\Services\Team\TeamAccess::class)->requireOwner($request->user(), $profile);
        $caseFile = $this->owned($request, $profile);

        try {
            $caseFile = $this->review->markReadyForClientReview($caseFile, $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'final_review' => $this->review->serialize($caseFile, forClient: false),
            'message' => 'Package marked ready for client review.',
        ]);
    }

    public function markReadyToSubmit(Request $request, ClientProfile $profile): JsonResponse
    {
        app(\App\Services\Team\TeamAccess::class)->requireOwner($request->user(), $profile);
        $caseFile = $this->owned($request, $profile);

        try {
            $caseFile = $this->review->markReadyToSubmit($caseFile, $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'final_review' => $this->review->serialize($caseFile, forClient: false),
            'submission' => $this->submission->serialize($caseFile),
            'auto_submitted' => false,
            'message' => 'Case is Ready to Submit. Confirm the government portal yourself — RCICMaster does not submit.',
        ]);
    }

    public function recordSubmission(Request $request, ClientProfile $profile): JsonResponse
    {
        app(\App\Services\Team\TeamAccess::class)->requireOwner($request->user(), $profile);
        $caseFile = $this->owned($request, $profile);
        $data = $request->validate([
            'submission_date' => 'required|date',
            'application_number' => 'nullable|string|max:128',
            'confirmation_number' => 'nullable|string|max:128',
            'government_fees' => 'nullable|numeric|min:0',
            'payment_confirmation' => 'nullable|string|max:255',
            'receipt' => 'nullable|file|max:10240',
        ]);

        if (empty($data['application_number']) && empty($data['confirmation_number'])) {
            return response()->json([
                'message' => 'Record an application number or confirmation number.',
            ], 422);
        }

        try {
            $caseFile = $this->submission->record(
                $caseFile,
                $request->user(),
                $data,
                $request->file('receipt'),
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'final_review' => $this->review->serialize($caseFile, forClient: false),
            'submission' => $this->submission->serialize($caseFile),
            'auto_submitted' => false,
            'message' => 'Submission confirmation stored. Nothing was sent to IRCC or a provincial portal.',
        ]);
    }

    public function acknowledge(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->owned($request, $profile);

        return response()->json([
            'message' => 'The consultant cannot acknowledge or sign on behalf of the client.',
        ], 403);
    }

    public function sign(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->owned($request, $profile);

        return response()->json([
            'message' => 'The consultant cannot acknowledge or sign on behalf of the client.',
        ], 403);
    }

    private function owned(Request $request, ClientProfile $profile): \App\Models\CaseFile
    {
        app(\App\Services\Team\TeamAccess::class)->authorize($request->user(), $profile);

        $caseFile = $this->lifecycle->resolveActiveCaseFile($profile, (int) $profile->consultant_id, createIfMissing: false);
        if (! $caseFile) {
            abort(404, 'No case file found.');
        }

        return $caseFile;
    }
}

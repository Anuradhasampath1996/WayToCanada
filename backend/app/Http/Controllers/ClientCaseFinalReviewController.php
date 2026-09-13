<?php

namespace App\Http\Controllers;

use App\Services\CaseFileLifecycleService;
use App\Services\CaseFinalReviewService;
use App\Services\CaseSubmissionConfirmationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientCaseFinalReviewController extends Controller
{
    public function __construct(
        private CaseFinalReviewService $review,
        private CaseSubmissionConfirmationService $submission,
        private CaseFileLifecycleService $lifecycle,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $caseFile = $this->caseFileFor($request);
        if (! $caseFile) {
            return response()->json(['final_review' => null, 'submission' => null]);
        }

        return response()->json([
            'final_review' => $this->review->serialize($caseFile, forClient: true),
            'submission' => $this->submission->serialize($caseFile),
        ]);
    }

    public function acknowledge(Request $request): JsonResponse
    {
        $caseFile = $this->caseFileFor($request);
        if (! $caseFile) {
            return response()->json(['message' => 'No active case file found.'], 404);
        }

        try {
            $caseFile = $this->review->acknowledge(
                $caseFile,
                $request->user(),
                $request->ip(),
                $request->userAgent(),
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'final_review' => $this->review->serialize($caseFile, forClient: true),
            'message' => 'Acknowledgement recorded.',
        ]);
    }

    public function sign(Request $request): JsonResponse
    {
        $caseFile = $this->caseFileFor($request);
        if (! $caseFile) {
            return response()->json(['message' => 'No active case file found.'], 404);
        }

        $data = $request->validate([
            'signature' => 'required|string|max:255',
        ]);

        try {
            $caseFile = $this->review->signDeclaration($caseFile, $request->user(), $data['signature']);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'final_review' => $this->review->serialize($caseFile, forClient: true),
            'message' => 'Declaration signed.',
        ]);
    }

    private function caseFileFor(Request $request): ?\App\Models\CaseFile
    {
        $profile = $request->user()->clientProfile;
        if (! $profile) {
            return null;
        }

        return $this->lifecycle->resolvePortalCaseFile($profile);
    }
}

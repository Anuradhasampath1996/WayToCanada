<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Services\CaseAssessmentGateService;
use App\Services\CaseFileLifecycleService;
use App\Services\CaseMapleRecommendationService;
use App\Support\EligibilityAssessmentRouter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantCaseAssessmentController extends Controller
{
    public function __construct(
        private CaseAssessmentGateService $gates,
        private CaseMapleRecommendationService $maple,
        private CaseFileLifecycleService $lifecycle,
    ) {}

    public function readiness(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->requireOwnedCase($request, $profile);
        $family = $request->query('family');

        return response()->json([
            'assessment' => $this->gates->serialize($caseFile),
            'calculator' => EligibilityAssessmentRouter::for(
                $caseFile,
                is_string($family) && $family !== '' ? $family : null,
            ),
        ]);
    }

    public function completeConsultation(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->requireOwnedCase($request, $profile);
        $data = $request->validate([
            'notes' => 'nullable|string|max:5000',
        ]);

        $caseFile = $this->gates->completeConsultation($caseFile, $request->user(), $data['notes'] ?? null);

        return response()->json([
            'assessment' => $this->gates->serialize($caseFile),
            'message' => 'Initial consultation recorded. The client questionnaire was not blocked.',
        ]);
    }

    public function skipConsultation(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->requireOwnedCase($request, $profile);
        $data = $request->validate([
            'reason' => 'required|string|min:8|max:500',
        ]);

        try {
            $caseFile = $this->gates->skipConsultation($caseFile, $request->user(), $data['reason']);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'assessment' => $this->gates->serialize($caseFile),
            'message' => 'Consultation skipped with a recorded reason.',
        ]);
    }

    public function reviewProfile(Request $request, ClientProfile $profile): JsonResponse
    {
        app(\App\Services\Team\TeamAccess::class)->requireOwner($request->user(), $profile);
        $caseFile = $this->requireOwnedCase($request, $profile);

        try {
            $caseFile = $this->gates->markProfileReviewed($caseFile, $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'assessment' => $this->gates->serialize($caseFile),
            'message' => 'Profile reviewed. Select Pathway is still blocked until consultation is also satisfied.',
        ]);
    }

    public function recommend(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->requireOwnedCase($request, $profile);
        $payload = $this->maple->generate($caseFile, $request->user());

        return response()->json([
            'maple_recommendation' => $payload,
            'pathway_auto_selected' => false,
            'message' => 'Maple recommendation stored as decision support. The consultant must select the final pathway.',
        ]);
    }

    private function requireOwnedCase(Request $request, ClientProfile $profile): \App\Models\CaseFile
    {
        app(\App\Services\Team\TeamAccess::class)->authorize($request->user(), $profile);

        $caseFile = $this->lifecycle->resolveActiveCaseFile($profile, (int) $profile->consultant_id, createIfMissing: false);
        if (! $caseFile) {
            abort(404, 'No case file found.');
        }

        return $caseFile;
    }
}

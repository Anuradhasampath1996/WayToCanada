<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Services\CaseClientAssignmentService;
use App\Services\CaseFileLifecycleService;
use App\Services\CaseRequirementPlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantCaseAssignmentController extends Controller
{
    public function __construct(
        private CaseClientAssignmentService $assignment,
        private CaseRequirementPlanService $plans,
        private CaseFileLifecycleService $lifecycle,
    ) {}

    public function show(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->requireOwnedCase($request, $profile);

        return response()->json([
            'assignment' => $this->assignment->serialize($caseFile, forClient: false),
            'requirement_plan' => $this->plans->serializePlan($this->plans->currentPlan($caseFile)),
        ]);
    }

    public function saveExtraData(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->requireOwnedCase($request, $profile);
        $data = $request->validate([
            'answers' => 'required|array|max:40',
            'answers.*' => 'nullable|string|max:500',
        ]);

        try {
            $plan = $this->assignment->saveExtraData(
                $caseFile,
                $request->user(),
                $data['answers'],
                allowNa: true,
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'assignment' => $this->assignment->serialize($caseFile->fresh(), forClient: false),
            'requirement_plan' => $this->plans->serializePlan($plan),
            'message' => 'Additional pathway details saved. Previous answers were kept.',
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

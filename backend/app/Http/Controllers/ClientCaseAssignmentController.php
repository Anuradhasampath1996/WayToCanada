<?php

namespace App\Http\Controllers;

use App\Services\CaseClientAssignmentService;
use App\Services\CaseFileLifecycleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientCaseAssignmentController extends Controller
{
    public function __construct(
        private CaseClientAssignmentService $assignment,
        private CaseFileLifecycleService $lifecycle,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $caseFile = $this->caseFileFor($request);
        if (! $caseFile) {
            return response()->json([
                'assignment' => null,
                'message' => 'No active case file found.',
            ]);
        }

        return response()->json([
            'assignment' => $this->assignment->serialize($caseFile, forClient: true),
        ]);
    }

    public function saveExtraData(Request $request): JsonResponse
    {
        $caseFile = $this->caseFileFor($request);
        if (! $caseFile) {
            return response()->json(['message' => 'No active case file found.'], 404);
        }

        if (! $caseFile->immigration_pathway) {
            return response()->json([
                'message' => 'Additional pathway details unlock after your consultant selects a pathway.',
            ], 422);
        }

        $data = $request->validate([
            'answers' => 'required|array|max:40',
            'answers.*' => 'nullable|string|max:500',
        ]);

        try {
            $this->assignment->saveExtraData(
                $caseFile,
                $request->user(),
                $data['answers'],
                allowNa: false,
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'assignment' => $this->assignment->serialize($caseFile->fresh(), forClient: true),
            'message' => 'Saved. Known profile answers were not asked again.',
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

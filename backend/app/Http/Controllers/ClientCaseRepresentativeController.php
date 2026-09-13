<?php

namespace App\Http\Controllers;

use App\Services\CaseActivationService;
use App\Services\CaseFileLifecycleService;
use App\Services\CaseRepresentativeAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientCaseRepresentativeController extends Controller
{
    public function __construct(
        private CaseRepresentativeAuthorizationService $representative,
        private CaseActivationService $activation,
        private CaseFileLifecycleService $lifecycle,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $caseFile = $this->caseFileFor($request);
        if (! $caseFile) {
            return response()->json(['representative' => null]);
        }

        return response()->json([
            'representative' => $this->representative->serialize($caseFile),
            'activation' => $this->activation->serialize($caseFile),
        ]);
    }

    public function sign(Request $request): JsonResponse
    {
        $caseFile = $this->caseFileFor($request);
        if (! $caseFile) {
            return response()->json(['message' => 'No active case file found.'], 404);
        }

        if ($caseFile->representative_state !== 'sent_to_client') {
            return response()->json([
                'message' => 'Representative authorization is not waiting for your signature.',
            ], 422);
        }

        try {
            $caseFile = $this->representative->markSigned($caseFile, $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'representative' => $this->representative->serialize($caseFile),
            'activation' => $this->activation->serialize($caseFile),
            'message' => 'Representative authorization signed.',
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

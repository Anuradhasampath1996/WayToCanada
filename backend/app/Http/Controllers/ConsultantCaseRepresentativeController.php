<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Services\CaseActivationService;
use App\Services\CaseFileLifecycleService;
use App\Services\CaseRepresentativeAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantCaseRepresentativeController extends Controller
{
    public function __construct(
        private CaseRepresentativeAuthorizationService $representative,
        private CaseActivationService $activation,
        private CaseFileLifecycleService $lifecycle,
    ) {}

    public function show(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->owned($request, $profile);

        return response()->json([
            'representative' => $this->representative->serialize($caseFile),
            'activation' => $this->activation->serialize($caseFile),
        ]);
    }

    public function transition(Request $request, ClientProfile $profile): JsonResponse
    {
        app(\App\Services\Team\TeamAccess::class)->requireOwner($request->user(), $profile);
        $caseFile = $this->owned($request, $profile);
        $data = $request->validate([
            'action' => 'required|in:send,sign,review,complete,leave_unused',
        ]);

        try {
            $caseFile = match ($data['action']) {
                'send' => $this->representative->sendToClient($caseFile, $request->user()),
                'sign' => $this->representative->markSigned($caseFile, $request->user()),
                'review' => $this->representative->review($caseFile, $request->user()),
                'complete' => $this->representative->complete($caseFile, $request->user()),
                'leave_unused' => $this->representative->leaveUnused($caseFile, $request->user()),
            };
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'representative' => $this->representative->serialize($caseFile),
            'activation' => $this->activation->serialize($caseFile),
            'message' => 'Representative authorization updated.',
        ]);
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

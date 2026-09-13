<?php

namespace App\Http\Controllers;

use App\Services\CaseDecisionService;
use App\Services\CaseFileLifecycleService;
use App\Services\CaseGovernmentRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientCasePostSubmissionController extends Controller
{
    public function __construct(
        private CaseGovernmentRequestService $requests,
        private CaseDecisionService $decisions,
        private CaseFileLifecycleService $lifecycle,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $profile = $request->user()->clientProfile;
        $caseFile = $profile ? $this->lifecycle->resolvePortalCaseFile($profile) : null;
        if (! $caseFile) {
            return response()->json(['government_requests' => null, 'decision' => null]);
        }

        return response()->json([
            'government_requests' => $this->requests->serialize($caseFile),
            'decision' => $this->decisions->serialize($caseFile),
        ]);
    }
}

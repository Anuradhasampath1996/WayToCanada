<?php

namespace App\Http\Controllers;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Services\CaseManagementHubService;
use App\Services\IrccInteractiveFormVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CaseManagementHubController extends Controller
{
    public function __construct(
        private CaseManagementHubService $hubService,
        private IrccInteractiveFormVerificationService $verificationService,
    ) {}

    /** GET /api/v1/consultant/clients/{profile}/case-management-hub */
    public function consultantShow(Request $request, ClientProfile $profile): JsonResponse
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        $caseFile = CaseFile::where('client_profile_id', $profile->id)->first();

        if (! $caseFile) {
            return response()->json(['message' => 'No case file found.'], 404);
        }

        $caseFile->syncStatusFromAgreement();
        $caseFile = $caseFile->fresh();
        $profile->load('user:id,name,email');

        return response()->json(array_merge(
            $this->hubService->buildForCaseFile($caseFile),
            ['client' => $profile],
        ));
    }

    /** GET /api/v1/client/case-management-hub */
    public function clientShow(Request $request): JsonResponse
    {
        $profile = $request->user()->clientProfile;

        if (! $profile?->caseFile) {
            return response()->json(['message' => 'No active case file found.'], 404);
        }

        $caseFile = $profile->caseFile;
        $caseFile->syncStatusFromAgreement();
        $caseFile = $caseFile->fresh();

        $verification = $this->verificationService->getVerificationStatus($caseFile);

        if (! ($verification['case_management_unlocked'] ?? false)) {
            return response()->json([
                'case_management_unlocked' => false,
                'verification'           => $verification,
                'case_file'              => $caseFile->only([
                    'id', 'status', 'immigration_pathway',
                    'agreement_signed_at', 'application_forms_verified_at',
                ]),
                'message'                => 'Complete and have your application forms reviewed before uploading documents.',
            ], 403);
        }

        return response()->json($this->hubService->buildForCaseFile($caseFile));
    }
}

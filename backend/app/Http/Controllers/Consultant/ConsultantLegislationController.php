<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Models\ConsultantLegislationBookmark;
use App\Services\ConsultantLegislationBookmarkService;
use App\Services\WorkspaceCaseLegislationService;
use App\Services\WorkspaceCaseRulesService;
use App\Services\WorkspaceCaseDetailService;
use App\Models\CaseFile;
use App\Models\QuestionnaireSubmission;
use App\Services\IrccInteractiveFormVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantLegislationController extends Controller
{
    public function __construct(
        private WorkspaceCaseLegislationService $caseLegislation,
        private ConsultantLegislationBookmarkService $bookmarks,
        private WorkspaceCaseRulesService $rules,
        private WorkspaceCaseDetailService $caseDetail,
        private IrccInteractiveFormVerificationService $verificationService,
    ) {}

    /** GET /api/v1/consultant/clients/{profile}/legislation/relevant */
    public function relevant(Request $request, ClientProfile $profile): JsonResponse
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        $context = $this->buildContext($profile, $request->user());

        return response()->json([
            'data' => $this->caseLegislation->relevantForCase($context),
        ]);
    }

    /** GET /api/v1/consultant/legislation/bookmarks */
    public function bookmarksIndex(Request $request): JsonResponse
    {
        $clientProfileId = $request->filled('client_profile_id')
            ? (int) $request->integer('client_profile_id')
            : null;

        return response()->json([
            'data' => $this->bookmarks->listForConsultant($request->user(), $clientProfileId),
        ]);
    }

    /** POST /api/v1/consultant/legislation/bookmarks */
    public function bookmarksStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'act_code'          => 'required|string|max:40',
            'provision_key'     => 'required|string|max:80',
            'language'          => 'nullable|string|in:en,fr',
            'label'             => 'nullable|string|max:255',
            'note'              => 'nullable|string|max:1000',
            'client_profile_id' => 'nullable|integer|exists:client_profiles,id',
        ]);

        if (! empty($data['client_profile_id'])) {
            $profile = ClientProfile::findOrFail($data['client_profile_id']);
            if ($profile->consultant_id !== $request->user()->id) {
                abort(403, 'Access denied.');
            }
        }

        $bookmark = $this->bookmarks->store($request->user(), $data);

        return response()->json(['data' => $bookmark, 'message' => 'Section saved.'], 201);
    }

    /** DELETE /api/v1/consultant/legislation/bookmarks/{bookmark} */
    public function bookmarksDestroy(Request $request, ConsultantLegislationBookmark $bookmark): JsonResponse
    {
        $this->bookmarks->delete($request->user(), $bookmark);

        return response()->json(['message' => 'Bookmark removed.']);
    }

    /** @return array<string, mixed> */
    private function buildContext(ClientProfile $profile, $consultant): array
    {
        $profile->loadMissing('user');
        $caseFile = CaseFile::firstOrCreate(
            ['client_profile_id' => $profile->id],
            ['consultant_id' => $consultant->id, 'status' => 'PENDING_ASSESSMENT'],
        );
        $caseFile->syncStatusFromAgreement();
        $submission   = QuestionnaireSubmission::where('user_id', $profile->user_id)->first();
        $verification = $this->verificationService->getVerificationStatus($caseFile->fresh());
        $context      = $this->rules->buildContextPack($profile, $caseFile->fresh(), $submission, $verification);
        $context['case_detail'] = $this->caseDetail->build($profile, $caseFile->fresh(), $submission);

        return $context;
    }
}

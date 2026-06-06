<?php

namespace App\Http\Controllers;

use App\Http\Controllers\ApplicationPackageController;
use App\Mail\RetainerAgreementEmail;
use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\IrccCategory;
use App\Services\IrccInteractiveFormVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class CaseFileController extends Controller
{
    public function __construct(
        private IrccInteractiveFormVerificationService $verificationService,
    ) {}

    // ── Private helper ─────────────────────────────────────────────────────────

    private function authorizeConsultant(Request $request, ClientProfile $profile): void
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }
    }

    private function getOrCreateCaseFile(ClientProfile $profile, Request $request): CaseFile
    {
        return CaseFile::firstOrCreate(
            ['client_profile_id' => $profile->id],
            ['consultant_id' => $request->user()->id, 'status' => 'PENDING_ASSESSMENT']
        );
    }

    private function prepareCaseFile(?CaseFile $caseFile): ?CaseFile
    {
        if (! $caseFile) {
            return null;
        }

        $caseFile->syncStatusFromAgreement();

        return $caseFile->fresh();
    }

    // ── GET /consultant/clients/{profile}/case-file ────────────────────────────

    public function show(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);
        $profile->load('user:id,name,email,phone');

        $caseFile = $this->prepareCaseFile($this->getOrCreateCaseFile($profile, $request));
        $caseFile?->loadMissing('assignedIrccCategory.documents');

        $consultant = $request->user();

        return response()->json([
            'case_file'  => $caseFile,
            'client'     => $profile,
            'consultant' => [
                'id'          => $consultant->id,
                'name'        => $consultant->name,
                'email'       => $consultant->email,
                'rcic_number' => $consultant->rcic_number,
            ],
            'application_forms_verification' => $this->verificationService->getVerificationStatus($caseFile),
            'application_package' => ApplicationPackageController::formatPackage(
                $caseFile->assignedIrccCategory,
                $caseFile->id
            ),
        ]);
    }

    // ── PATCH /consultant/clients/{profile}/case-file/select-pathway ───────────

    public function selectPathway(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'immigration_pathway' => 'required|string|max:100',
        ]);

        $caseFile = CaseFile::where('client_profile_id', $profile->id)->firstOrFail();

        $updates = ['immigration_pathway' => $data['immigration_pathway']];

        // Advance workflow only — never downgrade after agreement sent/signed.
        if ($caseFile->statusStep() < CaseFile::statusOrder()['PATHWAY_SELECTED']) {
            $updates['status'] = 'PATHWAY_SELECTED';
        }

        $caseFile->update($updates);

        // Mirror pathway to the client profile
        $profile->update(['immigration_pathway' => $data['immigration_pathway']]);

        return response()->json([
            'case_file' => $caseFile->fresh(),
            'message'   => 'Immigration pathway confirmed.',
        ]);
    }

    // ── PATCH /consultant/clients/{profile}/case-file/assign-application-package ─

    public function assignApplicationPackage(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'ircc_category_id' => 'required|exists:ircc_categories,id',
        ]);

        $category = IrccCategory::where('id', $data['ircc_category_id'])
            ->where('level', 3)
            ->firstOrFail();

        $caseFile = CaseFile::where('client_profile_id', $profile->id)->firstOrFail();

        if ($caseFile->statusStep() < CaseFile::statusOrder()['PATHWAY_SELECTED']) {
            return response()->json(['message' => 'Pathway must be selected before assigning an application package.'], 422);
        }

        $caseFile->update([
            'assigned_ircc_category_id'       => $category->id,
            'application_package_assigned_at'   => now(),
        ]);

        return response()->json([
            'case_file'           => $caseFile->fresh(),
            'application_package' => ApplicationPackageController::formatPackage($category, $caseFile->id),
            'message'             => 'Application package assigned to client.',
        ]);
    }

    // ── POST /consultant/clients/{profile}/case-file/send-agreement ────────────

    public function sendAgreement(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);
        $profile->load('user');

        $caseFile = CaseFile::where('client_profile_id', $profile->id)->firstOrFail();

        if ($caseFile->statusStep() < CaseFile::statusOrder()['PATHWAY_SELECTED']) {
            return response()->json(['message' => 'Pathway must be selected before sending the agreement.'], 422);
        }

        $request->validate([
            'agreement_fee'   => 'nullable|numeric|min:0',
            'agreement_notes' => 'nullable|string|max:5000',
        ]);

        $token = Str::random(64);
        $updateData = [
            'agreement_token'   => $token,
            'agreement_sent_at' => now(),
            'status'            => 'AGREEMENT_SENT',
        ];
        if ($request->filled('agreement_fee'))   $updateData['agreement_fee']   = $request->input('agreement_fee');
        if ($request->filled('agreement_notes')) $updateData['agreement_notes'] = $request->input('agreement_notes');

        $caseFile->update($updateData);

        Mail::to($profile->user->email)
            ->send(new RetainerAgreementEmail($profile, $caseFile->fresh(), $request->user()));

        return response()->json([
            'case_file' => $caseFile->fresh(),
            'message'   => 'Retainer agreement sent successfully.',
        ]);
    }

    // ── PATCH /consultant/clients/{profile}/case-file/checklist ───────────────

    public function updateChecklist(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $request->validate([
            'checklist_data' => 'required|array',
        ]);

        $caseFile = CaseFile::where('client_profile_id', $profile->id)->firstOrFail();

        if ($caseFile->statusStep() < CaseFile::statusOrder()['AGREEMENT_SIGNED']) {
            return response()->json(['message' => 'Agreement must be signed first.'], 422);
        }

        $caseFile->update(['checklist_data' => $request->checklist_data]);

        return response()->json([
            'case_file' => $caseFile->fresh(),
            'message'   => 'Checklist updated.',
        ]);
    }

    // ── Public: GET /case-file/agreement/{token} ───────────────────────────────

    public function getAgreement(string $token): JsonResponse
    {
        $caseFile = CaseFile::where('agreement_token', $token)
            ->with('clientProfile.user:id,name,email', 'consultant')
            ->firstOrFail();

        $c = $caseFile->consultant;

        return response()->json([
            'case_file' => $caseFile->only([
                'id', 'status', 'immigration_pathway',
                'agreement_sent_at', 'agreement_signed_at',
                'agreement_fee', 'agreement_notes',
                'client_signature', 'signed_document_path',
            ]),
            'client_name'        => $caseFile->clientProfile->user->name  ?? null,
            'client_email'       => $caseFile->clientProfile->user->email ?? null,
            'consultant_name'    => $c?->name ?? null,
            'consultant_profile' => $c ? [
                'name'                  => $c->name,
                'email'                 => $c->email,
                'phone'                 => $c->phone,
                'rcic_number'           => $c->rcic_number,
                'company_name'          => $c->company_name,
                'company_logo'          => $c->company_logo,
                'company_phone'         => $c->company_phone,
                'company_website'       => $c->company_website,
                'company_address_line1' => $c->company_address_line1,
                'company_address_line2' => $c->company_address_line2,
                'company_city'          => $c->company_city,
                'company_province'      => $c->company_province,
                'company_postal_code'   => $c->company_postal_code,
                'company_country'       => $c->company_country,
                'digital_signature'     => $c->digital_signature,
            ] : null,
        ]);
    }

    // ── Public: POST /case-file/agreement/{token}/sign ─────────────────────────

    public function signAgreement(Request $request, string $token): JsonResponse
    {
        $caseFile = CaseFile::where('agreement_token', $token)->firstOrFail();

        if ($caseFile->agreement_signed_at) {
            return response()->json(['message' => 'Agreement already signed.'], 409);
        }

        $request->validate([
            'signature_name'   => 'required|string|max:255',
            'client_signature' => 'nullable|string',
        ]);

        $sig = $request->input('client_signature');
        if ($sig !== null && !str_starts_with($sig, 'data:image/')) {
            return response()->json(['message' => 'Invalid signature format.'], 422);
        }

        $caseFile->update([
            'agreement_signed_at' => now(),
            'status'              => 'AGREEMENT_SIGNED',
            'client_signature'    => $sig,
        ]);

        return response()->json(['message' => 'Agreement signed successfully. Your consultant has been notified.']);
    }

    // ── Public: POST /case-file/agreement/{token}/upload-doc ──────────────────

    public function uploadSignedDoc(Request $request, string $token): JsonResponse
    {
        $caseFile = CaseFile::where('agreement_token', $token)->firstOrFail();

        $request->validate([
            'signed_doc' => 'required|file|mimes:pdf|max:10240',
        ]);

        $file     = $request->file('signed_doc');
        $filename = 'signed-agreement-' . $token . '.pdf';
        $file->storeAs('signed-agreements', $filename, 'public');

        $url = rtrim(config('app.url'), '/') . '/storage/signed-agreements/' . $filename;

        $caseFile->update([
            'signed_document_path' => $url,
            'agreement_signed_at'  => $caseFile->agreement_signed_at ?? now(),
            'status'               => 'AGREEMENT_SIGNED',
        ]);

        return response()->json([
            'message'             => 'Signed document uploaded successfully.',
            'signed_document_url' => $url,
        ]);
    }

    // ── Client: GET /client/dashboard ─────────────────────────────────────────

    public function clientDashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        // Find the client profile for this user
        $profile = ClientProfile::where('user_id', $user->id)
            ->with('consultant:id,name,email,phone,rcic_number,avatar')
            ->first();

        if (! $profile) {
            return response()->json([
                'case_file'  => null,
                'consultant' => null,
                'client'     => ['name' => $user->name, 'email' => $user->email],
            ]);
        }

        $caseFile = $this->prepareCaseFile(
            CaseFile::where('client_profile_id', $profile->id)
                ->with('assignedIrccCategory.documents')
                ->first()
        );

        return response()->json([
            'case_file'  => $caseFile,
            'application_package' => ApplicationPackageController::formatPackage($caseFile?->assignedIrccCategory, $caseFile?->id),
            'application_forms_verification' => $caseFile
                ? $this->verificationService->getVerificationStatus($caseFile)
                : null,
            'consultant' => $profile->consultant ? [
                'id'           => $profile->consultant->id,
                'name'         => $profile->consultant->name,
                'email'        => $profile->consultant->email,
                'phone'        => $profile->consultant->phone,
                'rcic_number'  => $profile->consultant->rcic_number,
                'avatar'       => $profile->consultant->avatar,
            ] : null,
            'client' => [
                'name'               => $user->name,
                'email'              => $user->email,
                'immigration_pathway'=> $profile->immigration_pathway,
            ],
        ]);
    }
}

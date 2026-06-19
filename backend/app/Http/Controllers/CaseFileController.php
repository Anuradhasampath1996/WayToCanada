<?php

namespace App\Http\Controllers;

use App\Http\Controllers\ApplicationPackageController;
use App\Mail\AgreementSignedEmail;
use App\Mail\RetainerAgreementEmail;
use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\ConsultantClientRequest;
use App\Models\IrccCategory;
use App\Mail\AgreementReminderEmail;
use App\Services\AgreementReminderService;
use App\Services\IrccInteractiveFormVerificationService;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\Notifications\WorkspaceNotificationTriggers;
use App\Services\RetainerAgreementPdfService;
use App\Services\TrustLedger\TrustLedgerService;
use App\Support\RetainerAgreementConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class CaseFileController extends Controller
{
    public function __construct(
        private IrccInteractiveFormVerificationService $verificationService,
        private RetainerAgreementPdfService $pdfService,
        private AgreementReminderService $reminderService,
        private WorkspaceNotificationTriggers $notify,
        private ClientActivityTriggers $activity,
        private TrustLedgerService $trust,
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
            'immigration_pathway' => 'nullable|string|max:100',
        ]);

        $caseFile = CaseFile::where('client_profile_id', $profile->id)->firstOrFail();

        $pathway = isset($data['immigration_pathway']) && $data['immigration_pathway'] !== ''
            ? $data['immigration_pathway']
            : null;

        if ($pathway === null) {
            if ($caseFile->statusStep() >= CaseFile::statusOrder()['AGREEMENT_SENT']) {
                return response()->json([
                    'message' => 'Cannot clear the pathway after the retainer agreement has been sent.',
                ], 422);
            }

            $caseFile->update([
                'immigration_pathway'         => null,
                'assigned_ircc_category_id'   => null,
                'application_package_assigned_at' => null,
                'status'                      => 'PENDING_ASSESSMENT',
            ]);

            $profile->update(['immigration_pathway' => null]);

            return response()->json([
                'case_file' => $caseFile->fresh(),
                'message'   => 'Pathway selection cleared.',
            ]);
        }

        $updates = ['immigration_pathway' => $pathway];

        // Advance workflow only — never downgrade after agreement sent/signed.
        if ($caseFile->statusStep() < CaseFile::statusOrder()['PATHWAY_SELECTED']) {
            $updates['status'] = 'PATHWAY_SELECTED';
        }

        $caseFile->update($updates);

        // Mirror pathway to the client profile
        $profile->update(['immigration_pathway' => $pathway]);

        $this->activity->onPathwayAssigned($profile, $caseFile->fresh(), $request->user(), $pathway, $request);

        return response()->json([
            'case_file' => $caseFile->fresh(),
            'message'   => 'Immigration pathway confirmed.',
        ]);
    }

    // ── PATCH /consultant/clients/{profile}/case-file/pathway-assessment ───────

    public function savePathwayAssessment(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'notes'              => 'nullable|string|max:10000',
            'crs_score'          => 'nullable|integer|min:0|max:1200',
            'ircc_crs_score'     => 'nullable|integer|min:0|max:1200',
            'rules_version'      => 'nullable|string|max:32',
            'assessment_snapshot'=> 'nullable|array',
        ]);

        $caseFile = CaseFile::where('client_profile_id', $profile->id)->firstOrFail();

        $caseFile->update([
            'pathway_assessment_notes'         => $data['notes'] ?? $caseFile->pathway_assessment_notes,
            'pathway_assessment_crs_score'     => $data['crs_score'] ?? $caseFile->pathway_assessment_crs_score,
            'pathway_assessment_ircc_crs_score'=> $data['ircc_crs_score'] ?? $caseFile->pathway_assessment_ircc_crs_score,
            'pathway_assessment_rules_version' => $data['rules_version'] ?? $caseFile->pathway_assessment_rules_version,
            'pathway_assessment_snapshot'      => $data['assessment_snapshot'] ?? $caseFile->pathway_assessment_snapshot,
            'pathway_assessment_at'            => now(),
        ]);

        return response()->json([
            'case_file' => $caseFile->fresh(),
            'message'   => 'Pathway assessment saved.',
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

        $this->activity->onApplicationPackageAssigned(
            $profile,
            $caseFile->fresh(),
            $request->user(),
            $category->label ?? 'Application package',
            $request,
        );

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

        if ($caseFile->isAgreementSigned()) {
            return response()->json(['message' => 'Cannot resend — the client has already signed this agreement.'], 422);
        }

        $request->validate(RetainerAgreementConfig::validateRules());

        $rawConfig = $request->input('agreement_config', []);
        $config    = RetainerAgreementConfig::normalize(
            is_array($rawConfig) ? $rawConfig : [],
            $caseFile->immigration_pathway
        );

        if (RetainerAgreementConfig::milestonePctSum($config) !== 100) {
            return response()->json(['message' => 'Milestone percentages must total exactly 100%.'], 422);
        }

        if ($request->filled('agreement_fee')) {
            $config['totalFee'] = (float) $request->input('agreement_fee');
        }

        if ($request->filled('agreement_notes')) {
            $config['customClauses'] = $request->input('agreement_notes');
        }

        $config['clientName']     = $config['clientName'] ?: ($profile->user->name ?? '');
        $config['clientEmail']    = $config['clientEmail'] ?: ($profile->user->email ?? '');
        $config['consultantName'] = $config['consultantName'] ?: $request->user()->name;

        $isResend = $caseFile->agreement_sent_at !== null && $caseFile->agreement_token;
        $token    = $isResend ? $caseFile->agreement_token : Str::random(64);

        $updateData = [
            'agreement_token'              => $token,
            'agreement_sent_at'            => now(),
            'agreement_version'            => $isResend ? ((int) $caseFile->agreement_version + 1) : 1,
            'agreement_config'             => $config,
            'agreement_fee'                => $config['totalFee'],
            'agreement_notes'              => $config['customClauses'] ?: null,
            'agreement_milestone_payments' => $caseFile->agreement_milestone_payments
                ?? RetainerAgreementConfig::defaultMilestonePayments(),
            'status'                       => 'AGREEMENT_SENT',
        ];

        $caseFile->update($updateData);

        Mail::to($profile->user->email)
            ->send(new RetainerAgreementEmail($profile, $caseFile->fresh(), $request->user()));

        $this->notify->onAgreementSent($profile, $caseFile->fresh(), $request->user());
        $this->activity->onAgreementSent($profile, $caseFile->fresh(), $request->user(), $request);

        return response()->json([
            'case_file' => $caseFile->fresh(),
            'message'   => $isResend
                ? 'Retainer agreement updated and resent to the client.'
                : 'Retainer agreement sent successfully.',
        ]);
    }

    // ── POST /consultant/clients/{profile}/case-file/send-agreement-reminder ───

    public function sendAgreementReminder(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);
        $profile->load('user');

        $caseFile = CaseFile::where('client_profile_id', $profile->id)->firstOrFail();

        if (! $caseFile->agreement_sent_at) {
            return response()->json(['message' => 'Agreement has not been sent yet.'], 422);
        }

        if ($caseFile->isAgreementSigned()) {
            return response()->json(['message' => 'Agreement is already signed.'], 422);
        }

        $phone = $this->reminderService->resolveClientPhone($profile);
        if (! $phone) {
            return response()->json(['message' => 'No client phone or WhatsApp number on file.'], 422);
        }

        $request->validate(['send_email' => 'boolean']);

        $clientName     = $profile->user->name ?? 'Client';
        $consultantName = $request->user()->name;
        $message        = $this->reminderService->buildReminderMessage($caseFile, $clientName, $consultantName);
        $whatsappUrl    = $this->reminderService->toWhatsAppUrl($phone, $message);

        $emailSent  = false;
        $twilioSent = false;
        $twilioError = null;

        if ($request->boolean('send_email', true) && $profile->user->email) {
            Mail::to($profile->user->email)
                ->send(new AgreementReminderEmail($profile, $caseFile, $request->user()));
            $emailSent = true;
        }

        $twilio = $this->reminderService->sendViaTwilio($phone, $message);
        $twilioSent  = $twilio['sent'];
        $twilioError = $twilio['error'];

        $caseFile->update([
            'agreement_last_reminder_at' => now(),
            'agreement_reminder_count'   => ((int) $caseFile->agreement_reminder_count) + 1,
        ]);

        return response()->json([
            'message'        => 'Reminder recorded.',
            'whatsapp_url'   => $whatsappUrl,
            'phone'          => $phone,
            'email_sent'     => $emailSent,
            'twilio_sent'    => $twilioSent,
            'twilio_error'   => $twilioError,
            'reminder_count' => $caseFile->fresh()->agreement_reminder_count,
            'last_reminder_at' => $caseFile->fresh()->agreement_last_reminder_at?->toIso8601String(),
        ]);
    }

    // ── GET /consultant/clients/{profile}/case-file/agreement-pdf ─────────────

    public function downloadAgreementPdf(Request $request, ClientProfile $profile): Response
    {
        $this->authorizeConsultant($request, $profile);

        $caseFile = CaseFile::where('client_profile_id', $profile->id)->firstOrFail();

        if (! $caseFile->agreement_sent_at) {
            abort(422, 'Agreement has not been sent yet.');
        }

        $pdf = $this->pdfService->generate($caseFile);

        return $pdf->download($this->pdfService->filename($caseFile));
    }

    // ── Public: GET /case-file/agreement/{token}/pdf ───────────────────────────

    public function downloadAgreementPdfPublic(string $token): Response
    {
        $caseFile = CaseFile::where('agreement_token', $token)->firstOrFail();

        if (! $caseFile->agreement_sent_at) {
            abort(404);
        }

        $pdf = $this->pdfService->generate($caseFile);

        return $pdf->download($this->pdfService->filename($caseFile));
    }

    // ── PATCH /consultant/clients/{profile}/case-file/agreement-milestones ─────

    public function updateAgreementMilestones(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'milestone_payments'   => 'required|array',
            'milestone_payments.1' => 'boolean',
            'milestone_payments.2' => 'boolean',
            'milestone_payments.3' => 'boolean',
        ]);

        $caseFile = CaseFile::where('client_profile_id', $profile->id)->firstOrFail();

        if (! $caseFile->isAgreementSigned()) {
            return response()->json(['message' => 'Agreement must be signed before tracking milestone payments.'], 422);
        }

        $caseFile->update([
            'agreement_milestone_payments' => $data['milestone_payments'],
        ]);

        return response()->json([
            'case_file' => $caseFile->fresh(),
            'message'   => 'Milestone payment status updated.',
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

        if (! $this->verificationService->isCaseManagementUnlocked($caseFile)) {
            return response()->json(['message' => 'Case management is not unlocked yet.'], 403);
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

        $c      = $caseFile->consultant;
        $config = RetainerAgreementConfig::formatAgreementPayload($caseFile);

        return response()->json([
            'case_file' => array_merge($caseFile->only([
                'id', 'status', 'immigration_pathway',
                'agreement_sent_at', 'agreement_signed_at',
                'agreement_fee', 'agreement_notes',
                'agreement_config', 'agreement_version',
                'agreement_milestone_payments',
                'client_signature', 'signed_document_path',
            ]), [
                'agreement_config' => $config,
            ]),
            'client_name'        => $config['clientName'] ?: ($caseFile->clientProfile->user->name ?? null),
            'client_email'       => $config['clientEmail'] ?: ($caseFile->clientProfile->user->email ?? null),
            'consultant_name'    => $config['consultantName'] ?: ($c?->name ?? null),
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

        $wasSigned = $caseFile->isAgreementSigned();

        $caseFile->update([
            'agreement_signed_at'        => now(),
            'status'                     => 'AGREEMENT_SIGNED',
            'client_signature'           => $sig,
            'agreement_signed_ip'        => $request->ip(),
            'agreement_signed_user_agent'=> substr((string) $request->userAgent(), 0, 500),
        ]);

        if (! $wasSigned) {
            $this->notifyConsultantAgreementSigned($caseFile->fresh(), 'digital_signature', $request);
        }

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

        $wasSigned = $caseFile->isAgreementSigned();

        $caseFile->update([
            'signed_document_path'       => $url,
            'agreement_signed_at'        => $caseFile->agreement_signed_at ?? now(),
            'status'                     => 'AGREEMENT_SIGNED',
            'agreement_signed_ip'        => $request->ip(),
            'agreement_signed_user_agent'=> substr((string) $request->userAgent(), 0, 500),
        ]);

        if (! $wasSigned) {
            $this->notifyConsultantAgreementSigned($caseFile->fresh(), 'uploaded_pdf', $request);
        }

        return response()->json([
            'message'             => 'Signed document uploaded successfully.',
            'signed_document_url' => $url,
        ]);
    }

    private function notifyConsultantAgreementSigned(CaseFile $caseFile, string $via, Request $request): void
    {
        $caseFile->loadMissing('clientProfile.user', 'consultant');
        $profile    = $caseFile->clientProfile;
        $consultant = $caseFile->consultant;

        if (! $profile?->user || ! $consultant) {
            return;
        }

        Mail::to($consultant->email)
            ->send(new AgreementSignedEmail($profile, $caseFile, $consultant, $via));

        $this->notify->onAgreementSigned($caseFile);
        $this->activity->onAgreementSigned($profile, $caseFile, $request);
        $this->trust->ensureTrustAccount($caseFile);
        $this->trust->syncMilestonesFromAgreement($caseFile);
    }

    // ── Client: GET /client/dashboard ─────────────────────────────────────────

    public function clientDashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        // Find the client profile for this user
        $profile = ClientProfile::where('user_id', $user->id)
            ->with('consultant:id,name,email,phone,rcic_number,avatar,company_logo,company_name')
            ->first();

        if (! $profile) {
            $pendingRequest = ConsultantClientRequest::query()
                ->where('client_user_id', $user->id)
                ->where('status', ConsultantClientRequest::STATUS_PENDING)
                ->with('consultant:id,name,rcic_number,company_name,company_logo,avatar,company_city,company_province,company_bio')
                ->latest()
                ->first();

            return response()->json([
                'case_file'        => null,
                'consultant'       => null,
                'client'           => ['name' => $user->name, 'email' => $user->email],
                'pending_request'  => $pendingRequest ? [
                    'id'         => $pendingRequest->id,
                    'status'     => $pendingRequest->status,
                    'message'    => $pendingRequest->message,
                    'created_at' => $pendingRequest->created_at?->toIso8601String(),
                    'consultant' => $pendingRequest->consultant ? [
                        'id'               => $pendingRequest->consultant->id,
                        'name'             => $pendingRequest->consultant->name,
                        'rcic_number'      => $pendingRequest->consultant->rcic_number,
                        'company_name'     => $pendingRequest->consultant->company_name,
                        'company_logo'     => $pendingRequest->consultant->company_logo,
                        'avatar'           => $pendingRequest->consultant->avatar,
                        'company_city'     => $pendingRequest->consultant->company_city,
                        'company_province' => $pendingRequest->consultant->company_province,
                        'company_bio'      => $pendingRequest->consultant->company_bio,
                    ] : null,
                ] : null,
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
                'company_logo' => $profile->consultant->company_logo,
                'company_name' => $profile->consultant->company_name,
            ] : null,
            'client' => [
                'name'               => $user->name,
                'email'              => $user->email,
                'immigration_pathway'=> $profile->immigration_pathway,
            ],
        ]);
    }
}

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
use App\Services\CaseFileLifecycleService;
use App\Services\GstHstRatesService;
use App\Services\IrccInteractiveFormVerificationService;
use App\Services\IrccPackageSuggestionService;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\Notifications\WorkspaceNotificationTriggers;
use App\Services\RetainerAgreementPdfService;
use App\Services\RetainerAgreementAiService;
use App\Services\TrustLedger\TrustLedgerService;
use App\Support\ClientAgreementDetails;
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
        private RetainerAgreementAiService $retainerAi,
        private WorkspaceNotificationTriggers $notify,
        private ClientActivityTriggers $activity,
        private TrustLedgerService $trust,
        private CaseFileLifecycleService $lifecycle,
        private IrccPackageSuggestionService $packageSuggestion,
        private \App\Services\PathwayCatalogService $pathwayCatalog,
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
        return $this->lifecycle->resolveActiveCaseFile($profile, $request->user()->id);
    }

    private function requireActiveCaseFile(ClientProfile $profile, Request $request): CaseFile
    {
        $caseFile = $this->lifecycle->resolveActiveCaseFile($profile, $request->user()->id, createIfMissing: false);
        if (! $caseFile) {
            abort(404, 'No case file found.');
        }

        return $caseFile;
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
        $healed = false;
        if ($caseFile) {
            $caseFile = $this->pathwayCatalog->backfillCodeIfNeeded($caseFile);
            $heal = $this->packageSuggestion->healMismatchIfNeeded($caseFile);
            $healed = (bool) ($heal['healed'] ?? false);
            $caseFile = $caseFile->fresh();
        }
        $caseFile?->loadMissing('assignedIrccCategory.documents');

        $consultant = $request->user();

        return response()->json([
            'case_file'  => $caseFile,
            'case_files' => $this->lifecycle->listCasesForProfile($profile),
            'lifecycle'  => $this->lifecycle->lifecycleMeta($profile, $caseFile),
            'client'     => $profile,
            'consultant' => [
                'id'          => $consultant->id,
                'name'        => $consultant->name,
                'email'       => $consultant->email,
                'rcic_number' => $consultant->rcic_number,
            ],
            'application_forms_verification' => $caseFile
                ? $this->verificationService->getVerificationStatus($caseFile)
                : null,
            'application_package' => ApplicationPackageController::formatPackage(
                $caseFile?->assignedIrccCategory,
                $caseFile?->id
            ),
            'package_auto_healed' => $healed,
        ]);
    }

    // ── PATCH /consultant/clients/{profile}/case-file/select-pathway ───────────

    public function selectPathway(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'immigration_pathway' => 'nullable|string|max:255',
            'pathway_code'        => 'nullable|string|max:64',
        ]);

        $caseFile = $this->requireActiveCaseFile($profile, $request);

        $rawLabel = isset($data['immigration_pathway']) && $data['immigration_pathway'] !== ''
            ? $data['immigration_pathway']
            : null;
        $rawCode = isset($data['pathway_code']) && $data['pathway_code'] !== ''
            ? $data['pathway_code']
            : null;

        if ($rawLabel === null && $rawCode === null) {
            if ($caseFile->statusStep() >= CaseFile::statusOrder()['AGREEMENT_SENT']) {
                return response()->json([
                    'message' => 'Cannot clear the pathway after the retainer agreement has been sent.',
                ], 422);
            }

            $caseFile->update([
                'immigration_pathway'         => null,
                'pathway_code'                => null,
                'assigned_ircc_category_id'   => null,
                'application_package_assigned_at' => null,
                'status'                      => 'PENDING_ASSESSMENT',
            ]);

            $profile->update([
                'immigration_pathway' => null,
                'pathway_code' => null,
            ]);

            return response()->json([
                'case_file' => $caseFile->fresh(),
                'message'   => 'Pathway selection cleared.',
            ]);
        }

        $resolved = $this->pathwayCatalog->resolve($rawCode, $rawLabel);
        $pathway = $resolved['label'] ?? $rawLabel;
        $pathwayCode = $resolved['code'] ?? $rawCode;

        if (! $pathway) {
            return response()->json(['message' => 'Unknown pathway.'], 422);
        }

        $updates = [
            'immigration_pathway' => $pathway,
            'pathway_code' => $pathwayCode,
        ];

        // Advance workflow only — never downgrade after agreement sent/signed.
        if ($caseFile->statusStep() < CaseFile::statusOrder()['PATHWAY_SELECTED']) {
            $updates['status'] = 'PATHWAY_SELECTED';
        }

        $caseFile->update($updates);

        // Mirror pathway to the client profile
        $profile->update([
            'immigration_pathway' => $pathway,
            'pathway_code' => $pathwayCode,
        ]);

        $this->activity->onPathwayAssigned($profile, $caseFile->fresh(), $request->user(), $pathway, $request);

        // Auto-assign matching IRCC application package (consultant can override on Step 3).
        $auto = $this->packageSuggestion->autoAssignForPathway($caseFile->fresh(), $pathway);
        $fresh = $caseFile->fresh();

        $node = $resolved['node'] ?? null;

        return response()->json([
            'case_file' => $fresh,
            'message'   => $auto['assigned']
                ? 'Immigration pathway confirmed and application package auto-assigned.'
                : 'Immigration pathway confirmed.',
            'package_suggestion' => $this->serializePackageSuggestion($auto['suggestion']),
            'package_auto_assigned' => (bool) $auto['assigned'],
            'pathway_code' => $pathwayCode,
            'pathway_node' => $node ? [
                'code' => $node->code,
                'label' => $node->label,
                'family' => $node->family,
                'crs_backend_value' => $node->crs_backend_value,
                'retainer_fee' => $node->retainer_fee,
                'retainer_description' => $node->retainer_description,
            ] : null,
        ]);
    }

    // ── GET /consultant/clients/{profile}/case-file/suggested-application-package ─

    public function suggestedApplicationPackage(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $caseFile = $this->requireActiveCaseFile($profile, $request);
        $heal = $this->packageSuggestion->healMismatchIfNeeded($caseFile);
        $caseFile = $caseFile->fresh();
        $suggestion = $heal['suggestion'];

        return response()->json([
            'suggestion' => $this->serializePackageSuggestion($suggestion),
            'assigned_ircc_category_id' => $caseFile->assigned_ircc_category_id,
            'package_auto_healed' => (bool) ($heal['healed'] ?? false),
            'message' => ($heal['healed'] ?? false)
                ? 'Assigned package did not match the pathway — Maple/rules corrected it automatically.'
                : null,
        ]);
    }

    /**
     * @param  array<string, mixed>  $suggestion
     * @return array<string, mixed>
     */
    private function serializePackageSuggestion(array $suggestion): array
    {
        $category = $suggestion['category'] ?? null;

        return [
            'ircc_category_id' => $category instanceof IrccCategory ? $category->id : null,
            'label'            => $category instanceof IrccCategory ? $category->label : null,
            'path'             => $suggestion['path'] ?? [],
            'source'           => $suggestion['source'] ?? 'none',
            'reason'           => $suggestion['reason'] ?? '',
            'confidence'       => $suggestion['confidence'] ?? 'low',
        ];
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

        $caseFile = $this->requireActiveCaseFile($profile, $request);

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

        $caseFile = $this->requireActiveCaseFile($profile, $request);

        if ($caseFile->statusStep() < CaseFile::statusOrder()['PATHWAY_SELECTED']) {
            return response()->json(['message' => 'Pathway must be selected before assigning an application package.'], 422);
        }

        $caseFile->update([
            'assigned_ircc_category_id'       => $category->id,
            'application_package_assigned_at'   => now(),
            'application_forms_verified_at'   => null,
        ]);

        $this->verificationService->getVerificationStatus($caseFile->fresh());

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

    // ── POST /consultant/clients/{profile}/case-file/generate-agreement ───────

    public function generateAgreement(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'instructions'  => 'required|string|max:6000',
            'total_fee'     => 'nullable|numeric|min:0|max:50000',
            'currency'      => 'nullable|string|in:CAD,USD',
            'payment_rules' => 'nullable|string|max:4000',
            'refund_policy' => 'nullable|string|max:10000',
            'pathway'       => 'nullable|string|max:150',
        ]);

        $result = $this->retainerAi->generate($request->user(), $profile, $data);

        return response()->json($result);
    }

    // ── POST /consultant/clients/{profile}/case-file/send-agreement ────────────

    public function sendAgreement(Request $request, ClientProfile $profile, GstHstRatesService $taxRates): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);
        $profile->load('user');

        $caseFile = $this->requireActiveCaseFile($profile, $request);

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

        if ($config['taxEnabled']) {
            $taxProvince = $config['taxProvince'] ?? '';
            $taxRate = $taxProvince ? $taxRates->getProvinceRate($taxProvince) : null;
            if (! $taxRate) {
                return response()->json([
                    'message' => 'Select a valid place of supply so the current synced tax rate can be applied.',
                ], 422);
            }
            $config['taxProvince'] = strtoupper($taxProvince);
            $config['taxLabel'] = $taxRate['label'];
            $config['taxRate'] = round((float) $taxRate['total_rate'] * 100, 3);
        }

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

        $caseFile = $this->requireActiveCaseFile($profile, $request);

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
        $message        = $this->reminderService->buildReminderMessage($caseFile, $clientName, $request->user());
        $structured     = $this->reminderService->buildReminderStructured($caseFile, $clientName, $request->user());
        $whatsappUrl    = $this->reminderService->toWhatsAppUrl($phone, $message);

        $emailSent  = false;
        $twilioSent = false;
        $twilioError = null;

        if ($request->boolean('send_email', true) && $profile->user->email) {
            Mail::to($profile->user->email)
                ->send(new AgreementReminderEmail($profile, $caseFile, $request->user()));
            $emailSent = true;
        }

        $twilio = $this->reminderService->sendWhatsApp($phone, $structured);
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

        $caseFile = $this->requireActiveCaseFile($profile, $request);

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

        $caseFile = $this->requireActiveCaseFile($profile, $request);

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

        $caseFile = $this->requireActiveCaseFile($profile, $request);

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
        $storedDetails = is_array($config['clientDetails'] ?? null) ? $config['clientDetails'] : null;

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
            'client_details'     => ClientAgreementDetails::extract($caseFile->clientProfile, $storedDetails),
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
            ->when(
                $user->consultant_id,
                fn ($q) => $q->where('consultant_id', $user->consultant_id),
            )
            ->with('consultant:id,name,email,phone,rcic_number,avatar,company_logo,company_name')
            ->latest('id')
            ->first()
            ?? ClientProfile::where('user_id', $user->id)
                ->with('consultant:id,name,email,phone,rcic_number,avatar,company_logo,company_name')
                ->latest('id')
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
            $this->lifecycle->resolvePortalCaseFile($profile)?->loadMissing('assignedIrccCategory.documents')
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

    // ── Case lifecycle (consultant) ───────────────────────────────────────────

    /** PATCH /consultant/clients/{profile}/case-file/lifecycle */
    public function updateLifecycle(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'action' => 'required|string|in:hold,resume,close,complete',
            'note'   => 'nullable|string|max:2000',
        ]);

        $caseFile = $this->lifecycle->resolveActiveCaseFile($profile, $request->user()->id);
        $updated = $this->lifecycle->updateLifecycle($profile, $caseFile, $data['action'], $data['note'] ?? null);

        return response()->json([
            'message'    => 'Case updated.',
            'case_file'  => $updated,
            'case_files' => $this->lifecycle->listCasesForProfile($profile),
            'lifecycle'  => $this->lifecycle->lifecycleMeta($profile, $updated),
        ]);
    }

    /** POST /consultant/clients/{profile}/case-file/open-new */
    public function openNewCase(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'note' => 'nullable|string|max:2000',
        ]);

        $caseFile = $this->lifecycle->openNewCase(
            $profile,
            $request->user()->id,
            $data['name'],
            $data['note'] ?? null,
        );
        $caseFile->loadMissing('assignedIrccCategory.documents');

        return response()->json([
            'message'    => 'New case opened.',
            'case_file'  => $caseFile,
            'case_files' => $this->lifecycle->listCasesForProfile($profile),
            'lifecycle'  => $this->lifecycle->lifecycleMeta($profile, $caseFile),
        ], 201);
    }

    /** PATCH /consultant/clients/{profile}/case-file/switch */
    public function switchActiveCase(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'case_file_id' => 'required|integer',
        ]);

        $caseFile = $this->lifecycle->switchActiveCase($profile, (int) $data['case_file_id']);
        $caseFile = $this->prepareCaseFile($caseFile);
        $caseFile?->loadMissing('assignedIrccCategory.documents');

        return response()->json([
            'message'    => 'Active case switched.',
            'case_file'  => $caseFile,
            'case_files' => $this->lifecycle->listCasesForProfile($profile),
            'lifecycle'  => $this->lifecycle->lifecycleMeta($profile, $caseFile),
            'application_forms_verification' => $caseFile
                ? $this->verificationService->getVerificationStatus($caseFile)
                : null,
        ]);
    }
}

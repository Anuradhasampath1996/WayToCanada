<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Models\IrccInteractiveForm;
use App\Models\IrccInteractiveFormResponse;
use App\Services\IrccInteractiveFormVerificationService;
use App\Support\IrccInteractiveFormSchema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantIrccInteractiveFormController extends Controller
{
    public function __construct(
        private IrccInteractiveFormVerificationService $verificationService,
    ) {}

    /** GET /api/v1/consultant/clients/{profile}/interactive-forms */
    public function index(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $caseFile = $profile->caseFile;
        if (! $caseFile?->assigned_ircc_category_id) {
            return response()->json([
                'category_id' => null,
                'forms'       => [],
            ]);
        }

        $forms = IrccInteractiveForm::where('ircc_category_id', $caseFile->assigned_ircc_category_id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        $responses = IrccInteractiveFormResponse::where('case_file_id', $caseFile->id)
            ->get()
            ->keyBy('ircc_interactive_form_id');

        return response()->json([
            'category_id'  => $caseFile->assigned_ircc_category_id,
            'case_file_id' => $caseFile->id,
            'forms'        => $forms->map(function (IrccInteractiveForm $form) use ($responses) {
                $response = $responses->get($form->id);

                return array_merge(
                    IrccInteractiveFormSchema::formatFormSummary($form, $response),
                    ['has_response' => $response !== null]
                );
            })->values(),
        ]);
    }

    /** GET /api/v1/consultant/clients/{profile}/interactive-forms/{form} */
    public function show(Request $request, ClientProfile $profile, IrccInteractiveForm $form): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $caseFile = $profile->caseFile;
        if (! $caseFile?->assigned_ircc_category_id || $form->ircc_category_id !== $caseFile->assigned_ircc_category_id) {
            abort(404);
        }

        $response = IrccInteractiveFormResponse::where('case_file_id', $caseFile->id)
            ->where('ircc_interactive_form_id', $form->id)
            ->first();

        return response()->json([
            'data' => IrccInteractiveFormSchema::formatForm($form, $response),
        ]);
    }

    /** PATCH /api/v1/consultant/clients/{profile}/interactive-forms/{form}/review */
    public function review(Request $request, ClientProfile $profile, IrccInteractiveForm $form): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $caseFile = $profile->caseFile;
        if (! $caseFile?->assigned_ircc_category_id || $form->ircc_category_id !== $caseFile->assigned_ircc_category_id) {
            abort(404);
        }

        $data = $request->validate([
            'consultant_notes' => 'nullable|string|max:10000',
            'mark_reviewed'    => 'nullable|boolean',
        ]);

        $response = IrccInteractiveFormResponse::where('case_file_id', $caseFile->id)
            ->where('ircc_interactive_form_id', $form->id)
            ->first();

        if (! $response) {
            return response()->json(['message' => 'Client has not started this form yet.'], 422);
        }

        $updates = [];

        if (array_key_exists('consultant_notes', $data)) {
            $updates['consultant_notes'] = $data['consultant_notes'];
        }

        if (! empty($data['mark_reviewed'])) {
            $updates['reviewed_at'] = now();
            $updates['reviewed_by'] = $request->user()->id;
        }

        $response->update($updates);

        if (! empty($data['mark_reviewed'])) {
            $this->verificationService->syncVerificationComplete($caseFile->fresh());
        }

        return response()->json([
            'message' => 'Review saved.',
            'data'    => IrccInteractiveFormSchema::formatForm($form, $response->fresh()),
            'verification' => $this->verificationService->getVerificationStatus($caseFile->fresh()),
        ]);
    }

    /** GET /api/v1/consultant/clients/{profile}/interactive-forms/verification-status */
    public function verificationStatus(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $caseFile = $profile->caseFile;
        if (! $caseFile) {
            return response()->json([
                'verification' => [
                    'agreement_signed'         => false,
                    'total_forms'              => 0,
                    'submitted_count'          => 0,
                    'reviewed_count'           => 0,
                    'all_submitted'            => false,
                    'all_reviewed'             => false,
                    'verified_at'              => null,
                    'case_management_unlocked' => false,
                ],
            ]);
        }

        return response()->json([
            'verification' => $this->verificationService->getVerificationStatus($caseFile),
        ]);
    }

    /** PATCH /api/v1/consultant/clients/{profile}/interactive-forms/{form}/verify-field */
    public function verifyField(Request $request, ClientProfile $profile, IrccInteractiveForm $form): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $caseFile = $profile->caseFile;
        if (! $caseFile?->assigned_ircc_category_id || $form->ircc_category_id !== $caseFile->assigned_ircc_category_id) {
            abort(404);
        }

        $data = $request->validate([
            'field_key' => 'required|string|max:100',
            'verified'  => 'required|boolean',
        ]);

        $response = IrccInteractiveFormResponse::where('case_file_id', $caseFile->id)
            ->where('ircc_interactive_form_id', $form->id)
            ->first();

        if (! $response) {
            return response()->json(['message' => 'Client has not submitted this form yet.'], 422);
        }

        $verifiedFields = $response->verified_fields ?? [];

        if ($data['verified']) {
            $verifiedFields[$data['field_key']] = true;
        } else {
            unset($verifiedFields[$data['field_key']]);
        }

        $response->update(['verified_fields' => $verifiedFields]);

        return response()->json([
            'message'         => 'Field verification updated.',
            'verified_fields' => $verifiedFields,
            'data'            => IrccInteractiveFormSchema::formatForm($form, $response->fresh()),
        ]);
    }

    private function authorizeConsultant(Request $request, ClientProfile $profile): void
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }
    }
}

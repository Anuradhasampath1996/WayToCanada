<?php

namespace App\Http\Controllers;

use App\Models\CaseFile;
use App\Models\IrccInteractiveForm;
use App\Models\IrccInteractiveFormResponse;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\QuestionnaireFormPrefillService;
use App\Support\IrccInteractiveFormSchema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientIrccInteractiveFormController extends Controller
{
    public function __construct(
        private ClientActivityTriggers $activity,
    ) {}

    /** GET /api/v1/client/interactive-forms */
    public function index(Request $request): JsonResponse
    {
        $caseFile = $this->requireAssignedCaseFile($request);

        $forms = IrccInteractiveForm::where('ircc_category_id', $caseFile->assigned_ircc_category_id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        $responses = IrccInteractiveFormResponse::where('case_file_id', $caseFile->id)
            ->get()
            ->keyBy('ircc_interactive_form_id');

        return response()->json([
            'case_file_id' => $caseFile->id,
            'category_id'  => $caseFile->assigned_ircc_category_id,
            'forms'        => $forms->map(
                fn (IrccInteractiveForm $form) => IrccInteractiveFormSchema::formatFormSummary(
                    $form,
                    $responses->get($form->id)
                )
            )->values(),
        ]);
    }

    /** GET /api/v1/client/interactive-forms/{form} */
    public function show(Request $request, IrccInteractiveForm $form): JsonResponse
    {
        $caseFile = $this->requireAssignedCaseFile($request);
        $this->ensureFormAccessible($caseFile, $form);

        $response = IrccInteractiveFormResponse::where('case_file_id', $caseFile->id)
            ->where('ircc_interactive_form_id', $form->id)
            ->first();

        $prefill = app(QuestionnaireFormPrefillService::class)->buildPrefill($request->user());
        $mergedData = app(QuestionnaireFormPrefillService::class)->mergePrefill(
            $response?->response_data ?? [],
            $prefill
        );

        return response()->json([
            'data'    => IrccInteractiveFormSchema::formatForm($form, $response),
            'prefill' => $prefill,
            'merged_data' => $mergedData,
        ]);
    }

    /** PUT /api/v1/client/interactive-forms/{form} */
    public function upsert(Request $request, IrccInteractiveForm $form): JsonResponse
    {
        $caseFile = $this->requireAssignedCaseFile($request);
        $this->ensureFormAccessible($caseFile, $form);

        $data = $request->validate([
            'response_data' => 'required|array',
        ]);

        $existing = IrccInteractiveFormResponse::where('case_file_id', $caseFile->id)
            ->where('ircc_interactive_form_id', $form->id)
            ->first();

        if ($existing?->isSubmitted()) {
            return response()->json(['message' => 'This form has already been submitted.'], 422);
        }

        $clean = IrccInteractiveFormSchema::validateResponseData(
            $form->form_schema,
            $data['response_data'],
            strict: false
        );

        $response = IrccInteractiveFormResponse::updateOrCreate(
            [
                'case_file_id'             => $caseFile->id,
                'ircc_interactive_form_id' => $form->id,
            ],
            [
                'user_id'       => $request->user()->id,
                'response_data' => $clean,
                'status'        => IrccInteractiveFormResponse::STATUS_DRAFT,
            ]
        );

        return response()->json([
            'message' => 'Draft saved.',
            'data'    => IrccInteractiveFormSchema::formatForm($form, $response),
        ]);
    }

    /** POST /api/v1/client/interactive-forms/{form}/submit */
    public function submit(Request $request, IrccInteractiveForm $form): JsonResponse
    {
        $caseFile = $this->requireAssignedCaseFile($request);
        $this->ensureFormAccessible($caseFile, $form);

        $data = $request->validate([
            'response_data' => 'nullable|array',
        ]);

        $response = IrccInteractiveFormResponse::firstOrCreate(
            [
                'case_file_id'             => $caseFile->id,
                'ircc_interactive_form_id' => $form->id,
            ],
            [
                'user_id'       => $request->user()->id,
                'response_data' => [],
                'status'        => IrccInteractiveFormResponse::STATUS_DRAFT,
            ]
        );

        if ($response->isSubmitted()) {
            return response()->json(['message' => 'Form already submitted.', 'data' => IrccInteractiveFormSchema::formatResponse($response)]);
        }

        $payload = $data['response_data'] ?? $response->response_data ?? [];
        $clean = IrccInteractiveFormSchema::validateResponseData(
            $form->form_schema,
            is_array($payload) ? $payload : [],
            strict: true
        );

        $response->update([
            'user_id'       => $request->user()->id,
            'response_data' => $clean,
            'status'        => IrccInteractiveFormResponse::STATUS_SUBMITTED,
            'submitted_at'  => now(),
        ]);

        $profile = $request->user()->clientProfile;
        if ($profile) {
            $this->activity->onIrccFormSubmitted($profile, $form->title, $request->user(), $request);
        }

        return response()->json([
            'message' => 'Form submitted successfully.',
            'data'    => IrccInteractiveFormSchema::formatForm($form, $response->fresh()),
        ]);
    }

    private function requireAssignedCaseFile(Request $request): CaseFile
    {
        $profile = $request->user()->clientProfile;
        $caseFile = $profile?->caseFile;

        if (! $caseFile?->assigned_ircc_category_id) {
            abort(422, 'No application package has been assigned to your case yet.');
        }

        return $caseFile;
    }

    private function ensureFormAccessible(CaseFile $caseFile, IrccInteractiveForm $form): void
    {
        if (! $form->is_active || $form->ircc_category_id !== $caseFile->assigned_ircc_category_id) {
            abort(404);
        }
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Models\IrccPackageDocumentSubmission;
use App\Models\QuestionnaireSubmission;
use App\Services\GovernmentForms\ApplicationInfoReviewService;
use App\Services\GovernmentForms\CanonicalDataResolver;
use App\Services\GovernmentForms\FormGenerationService;
use App\Services\GovernmentForms\GovernmentFormAuthorizationService;
use App\Services\GovernmentForms\GovernmentFormGenerationException;
use App\Services\GovernmentForms\GovernmentFormRegistryService;
use App\Services\GovernmentForms\GovernmentFormGapFillService;
use App\Services\GovernmentForms\GovernmentFormStoragePathValidator;
use App\Services\GovernmentForms\FormFillCoverageService;
use App\Services\GovernmentForms\CaseGovernmentFormCodes;
use App\Services\GovernmentForms\StaleFormDetector;
use App\Data\GovernmentForms\FormReadinessResult;
use App\Models\CaseFile;
use App\Support\GovernmentForms\CanonicalKeyLabel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ConsultantGovernmentFormController extends Controller
{
    public function __construct(
        private GovernmentFormAuthorizationService $authorization,
        private ApplicationInfoReviewService $reviewService,
        private FormGenerationService $generationService,
        private GovernmentFormRegistryService $registry,
        private StaleFormDetector $staleDetector,
        private GovernmentFormStoragePathValidator $pathValidator,
        private GovernmentFormGapFillService $gapFillService,
        private CanonicalDataResolver $canonicalResolver,
        private FormFillCoverageService $fillCoverageService,
        private CaseGovernmentFormCodes $formCodes,
    ) {}

    /** GET /consultant/clients/{profile}/government-forms */
    public function index(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorization->authorizeConsultantForProfile($request->user(), $profile);
        $caseFile = $this->authorization->resolveCaseFile($profile, $request->integer('case_file_id') ?: null);

        $resolved = $this->formCodes->resolve($caseFile);
        $forms = $this->buildFormPayloads($request, $profile, $caseFile, $resolved['fillable']);

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->first();
        $fieldRemarks = $submission?->field_remarks ?? [];

        return response()->json([
            'application_info_reviewed' => $this->reviewService->isReviewed($caseFile),
            'application_info_stale'    => $this->reviewService->isStale($caseFile),
            'reviewed_at'               => $caseFile->application_info_reviewed_at,
            'field_remarks'             => $fieldRemarks,
            'forms'                     => $forms,
            'pathway_forms'             => $resolved['package_reference'],
        ]);
    }

    /** POST /consultant/clients/{profile}/government-forms/application-info/review */
    public function reviewApplicationInfo(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorization->authorizeConsultantForProfile($request->user(), $profile);
        $caseFile = $this->authorization->resolveCaseFile($profile, $request->integer('case_file_id') ?: null);
        $updated = $this->reviewService->markReviewed($caseFile, $request->user());

        return response()->json([
            'message'                   => 'Application information reviewed.',
            'application_info_reviewed' => true,
            'reviewed_at'               => $updated->application_info_reviewed_at,
            'questionnaire_snapshot_hash' => $updated->questionnaire_snapshot_hash,
        ]);
    }

    /** PATCH /consultant/clients/{profile}/government-forms/gap-fields */
    public function fillGapField(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorization->authorizeConsultantForProfile($request->user(), $profile);
        $caseFile = $this->authorization->resolveCaseFile($profile, $request->integer('case_file_id') ?: null);

        $data = $request->validate([
            'canonical_key' => 'required|string|max:200',
            'value'         => 'nullable|string|max:5000',
        ]);

        try {
            $this->gapFillService->fill(
                $profile,
                $request->user(),
                $data['canonical_key'],
                $data['value'] ?? '',
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $resolved = $this->formCodes->resolve($caseFile);
        $forms = [];
        foreach ($resolved['fillable'] as $formCode) {
            $readiness = $this->generationService->readinessLive($request->user(), $profile, $formCode, $caseFile->id);
            $forms[] = [
                'form_code' => $formCode,
                'readiness' => $this->serializeReadiness($readiness),
            ];
        }

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->first();

        return response()->json([
            'message'               => 'Field saved successfully.',
            'application_info_stale' => $this->reviewService->isStale($caseFile->fresh()),
            'field_remarks'         => $submission?->field_remarks ?? [],
            'forms'                 => $forms,
        ]);
    }

    /**
     * POST /consultant/clients/{profile}/government-forms/request-unanswered
     * Requests unanswered mapped autofill fields across all fillable pathway forms (deduped).
     */
    public function requestAllUnanswered(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorization->authorizeConsultantForProfile($request->user(), $profile);
        $caseFile = $this->authorization->resolveCaseFile($profile, $request->integer('case_file_id') ?: null);

        $data = $request->validate([
            'remark' => 'nullable|string|max:2000',
        ]);

        $resolved = $this->formCodes->resolve($caseFile);
        $result = $this->applyUnansweredRequests(
            $profile,
            $caseFile,
            $resolved['fillable'],
            $data['remark'] ?? null,
        );

        $forms = [];
        foreach ($resolved['fillable'] as $formCode) {
            $version = $this->registry->findActiveVersion($formCode);
            if (! $version) {
                continue;
            }
            $forms[] = [
                'form_code'     => $formCode,
                'fill_coverage' => $this->fillCoverageService->assess($profile, $version, $caseFile),
            ];
        }

        return response()->json([
            'message' => $result['requested_count'] === 0
                ? 'No unanswered client fields to request.'
                : "Requested {$result['requested_count']} unanswered field(s) from the client.",
            'requested_count' => $result['requested_count'],
            'field_remarks'   => $result['field_remarks'],
            'forms'           => $forms,
            'pathway_forms'   => $resolved['package_reference'],
        ]);
    }

    /**
     * POST /consultant/clients/{profile}/government-forms/{formCode}/request-unanswered
     * Creates questionnaire field_remarks for all unanswered mapped autofill fields.
     */
    public function requestUnanswered(Request $request, ClientProfile $profile, string $formCode): JsonResponse
    {
        $this->authorization->authorizeConsultantForProfile($request->user(), $profile);
        $caseFile = $this->authorization->resolveCaseFile($profile, $request->integer('case_file_id') ?: null);

        $normalized = $this->formCodes->normalize($formCode);
        $version = $this->registry->findActiveVersion($normalized);
        if (! $version) {
            abort(404);
        }

        $data = $request->validate([
            'remark' => 'nullable|string|max:2000',
        ]);

        $result = $this->applyUnansweredRequests(
            $profile,
            $caseFile,
            [$normalized],
            $data['remark'] ?? null,
        );

        return response()->json([
            'message' => $result['requested_count'] === 0
                ? 'No unanswered client fields to request.'
                : "Requested {$result['requested_count']} unanswered field(s) from the client.",
            'requested_count' => $result['requested_count'],
            'field_remarks'   => $result['field_remarks'],
            'fill_coverage'   => $this->fillCoverageService->assess($profile, $version, $caseFile),
        ]);
    }

    /** GET /consultant/clients/{profile}/government-forms/{formCode}/readiness */
    public function readiness(Request $request, ClientProfile $profile, string $formCode): JsonResponse
    {
        try {
            $result = $this->generationService->readiness(
                $request->user(),
                $profile,
                strtoupper($formCode),
                $request->integer('case_file_id') ?: null,
            );
        } catch (GovernmentFormGenerationException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(array_merge([
            'form_code'  => $result->formCode,
            'required_count' => $result->requiredCount,
            'filled_count'   => $result->filledCount,
        ], $this->serializeReadiness($result)));
    }

    /** POST /consultant/clients/{profile}/government-forms/{formCode}/generate */
    public function generate(Request $request, ClientProfile $profile, string $formCode): JsonResponse
    {
        try {
            $result = $this->generationService->generate(
                $request->user(),
                $profile,
                strtoupper($formCode),
                $request->integer('case_file_id') ?: null,
            );
        } catch (GovernmentFormGenerationException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message'    => 'Government form generated successfully.',
            'submission' => $this->serializeSubmission($result['submission'], $result['submission']->caseFile),
            'readiness'  => [
                'percentage' => $result['readiness']->percentage,
                'ready'      => $result['readiness']->ready,
            ],
            'review_stale' => $result['stale'],
            'adobe_note' => 'RCICMaster has populated this official government form. Open the downloaded file in Adobe Acrobat Reader to complete any official validation, signature, or final form actions.',
        ], 201);
    }

    /** POST /consultant/clients/{profile}/government-forms/generations/{submission}/mark-reviewed */
    public function markReviewed(Request $request, ClientProfile $profile, IrccPackageDocumentSubmission $submission): JsonResponse
    {
        $updated = $this->generationService->markReviewed($request->user(), $profile, $submission);

        return response()->json(['submission' => $this->serializeSubmission($updated, $updated->caseFile)]);
    }

    /** GET /consultant/clients/{profile}/government-forms/{formCode}/resolved-data */
    public function resolvedData(Request $request, ClientProfile $profile, string $formCode): JsonResponse
    {
        $this->authorization->authorizeConsultantForProfile($request->user(), $profile);
        $caseFile = $this->authorization->resolveCaseFile($profile, $request->integer('case_file_id') ?: null);

        $version = $this->registry->findActiveVersion(strtoupper($formCode));
        if (! $version) {
            abort(404);
        }

        $canonical = $this->reviewService->isReviewed($caseFile)
            ? $this->canonicalResolver->resolve($caseFile)
            : $this->canonicalResolver->resolveLive($caseFile);

        $fields = $version->mappings()
            ->orderBy('sort_order')
            ->get()
            ->map(function ($mapping) use ($canonical) {
                $value = $canonical->get($mapping->canonical_key);
                $filled = $value !== null && $value !== '';

                return [
                    'key'    => $mapping->canonical_key,
                    'label'  => $this->humanizeCanonicalKey($mapping->canonical_key),
                    'value'  => $filled ? (string) $value : null,
                    'filled' => $filled,
                ];
            })
            ->values();

        return response()->json([
            'form_code' => strtoupper($formCode),
            'fields'    => $fields,
        ]);
    }

    /** GET /consultant/clients/{profile}/government-forms/{formCode}/template-preview */
    public function templatePreview(Request $request, ClientProfile $profile, string $formCode): StreamedResponse
    {
        $this->authorization->authorizeConsultantForProfile($request->user(), $profile);

        $version = $this->registry->findActiveVersion(strtoupper($formCode));
        if (! $version || $version->template_storage_path === null) {
            abort(404, 'Official template not available.');
        }

        try {
            $safeRelativePath = $this->pathValidator->resolveTemplatePath($version->template_storage_path, 'local');
        } catch (\Illuminate\Auth\Access\AuthorizationException) {
            abort(403, 'Access denied.');
        } catch (\Illuminate\Contracts\Filesystem\FileNotFoundException) {
            abort(404, 'Official template not found.');
        }

        $filename = $version->form_code.'-'.$version->version_label.'-official.pdf';
        $disposition = ($request->boolean('download') ? 'attachment' : 'inline')
            .'; filename="'.addslashes($filename).'"';

        return Storage::disk('local')->response($safeRelativePath, $filename, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => $disposition,
            'Cache-Control'       => 'private, max-age=3600',
        ]);
    }

    private function humanizeCanonicalKey(string $key): string
    {
        return CanonicalKeyLabel::from($key);
    }

    /** GET /consultant/clients/{profile}/government-forms/generations/{submission}/download */
    public function download(Request $request, ClientProfile $profile, IrccPackageDocumentSubmission $submission): BinaryFileResponse|StreamedResponse
    {
        $this->authorization->authorizeConsultantForProfile($request->user(), $profile);
        $submission->loadMissing('caseFile', 'governmentFormVersion');

        if ($submission->caseFile?->client_profile_id !== $profile->id || ! $submission->isAutoGenerated()) {
            abort(403, 'Access denied.');
        }

        if ($submission->file_path === null) {
            abort(403, 'Access denied.');
        }

        $diskName = $submission->storage_disk ?: 'local';
        $wantFlattenedPreview = $request->boolean('flattened') || $request->boolean('preview');

        if ($wantFlattenedPreview) {
            try {
                $fields = [];
                if ($submission->governmentFormVersion) {
                    $caseFile = $submission->caseFile;
                    $canonical = $this->reviewService->isReviewed($caseFile)
                        ? $this->canonicalResolver->resolve($caseFile)
                        : $this->canonicalResolver->resolveLive($caseFile);

                    $fields = $submission->governmentFormVersion->mappings()
                        ->orderBy('sort_order')
                        ->get()
                        ->map(function ($mapping) use ($canonical) {
                            $value = $canonical->get($mapping->canonical_key);
                            $filled = $value !== null && $value !== '';

                            return [
                                'key'    => $mapping->canonical_key,
                                'label'  => $this->humanizeCanonicalKey($mapping->canonical_key),
                                'value'  => $filled ? (string) $value : null,
                                'filled' => $filled,
                            ];
                        })
                        ->values()
                        ->all();
                }

                $previewAbsolute = $this->generationService->ensureBrowserPreviewAbsolutePath($submission, $fields);
            } catch (GovernmentFormGenerationException $e) {
                abort(422, $e->getMessage());
            }

            $filename = pathinfo($submission->original_filename ?: 'form.pdf', PATHINFO_FILENAME).'-browser-preview.pdf';
            $disposition = $request->boolean('download') ? 'attachment' : 'inline';

            return response()->file($previewAbsolute, [
                'Content-Type'        => 'application/pdf',
                'Content-Disposition' => $disposition.'; filename="'.addslashes($filename).'"',
                'Cache-Control'       => 'private, max-age=300',
            ]);
        }

        try {
            $safeRelativePath = $this->pathValidator->resolveGeneratedPath($submission->file_path, $diskName);
        } catch (\Illuminate\Auth\Access\AuthorizationException) {
            abort(403, 'Access denied.');
        } catch (\Illuminate\Contracts\Filesystem\FileNotFoundException) {
            abort(404, 'Generated form not found.');
        }

        $disk = Storage::disk($diskName);

        $disposition = ($request->boolean('download') ? 'attachment' : 'inline')
            .'; filename="'.addslashes($submission->original_filename).'"';

        return $disk->response($safeRelativePath, $submission->original_filename, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => $disposition,
            'Cache-Control'       => 'private, max-age=3600',
        ]);
    }

    /**
     * @param  list<string>  $fillableCodes
     * @return list<array<string, mixed>>
     */
    private function buildFormPayloads(
        Request $request,
        ClientProfile $profile,
        CaseFile $caseFile,
        array $fillableCodes,
    ): array {
        $forms = [];
        foreach ($fillableCodes as $formCode) {
            $version = $this->registry->findActiveVersion($formCode);
            if (! $version) {
                continue;
            }

            $readiness = $this->generationService->readinessLive($request->user(), $profile, $formCode, $caseFile->id);
            $current = $this->generationService->currentGeneration($caseFile, $formCode);
            $fillCoverage = $this->fillCoverageService->assess($profile, $version, $caseFile);

            $forms[] = [
                'form_code'          => $formCode,
                'name'               => $version->name,
                'version_label'      => $version->version_label,
                'readiness'          => $this->serializeReadiness($readiness),
                'fill_coverage'      => $fillCoverage,
                'current_generation' => $current ? $this->serializeSubmission($current, $caseFile) : null,
            ];
        }

        return $forms;
    }

    /**
     * @param  list<string>  $formCodes
     * @return array{requested_count: int, field_remarks: array<string, mixed>}
     */
    private function applyUnansweredRequests(
        ClientProfile $profile,
        CaseFile $caseFile,
        array $formCodes,
        ?string $customRemark,
    ): array {
        $submission = QuestionnaireSubmission::firstOrCreate(['user_id' => $profile->user_id]);
        $remarks = $submission->field_remarks ?? [];
        $verified = $submission->verified_fields ?? [];
        $requested = 0;

        /** @var array<string, list<string>> $formCodesByKey */
        $formCodesByKey = [];

        foreach ($formCodes as $formCode) {
            $version = $this->registry->findActiveVersion($formCode);
            if (! $version) {
                continue;
            }

            $coverage = $this->fillCoverageService->assess($profile, $version, $caseFile);
            $defaultRemark = $customRemark
                ?? ('Please complete this information so we can auto-fill your government form(s).');

            foreach ($coverage['unanswered_fields'] as $field) {
                if (! ($field['can_request'] ?? false) || empty($field['questionnaire_key'])) {
                    continue;
                }

                $qKey = $field['questionnaire_key'];
                $formCodesByKey[$qKey] ??= [];
                if (! in_array($formCode, $formCodesByKey[$qKey], true)) {
                    $formCodesByKey[$qKey][] = $formCode;
                }

                $existing = $remarks[$qKey] ?? null;
                $isNew = ! is_array($existing) || ($existing['status'] ?? '') !== 'pending';

                $primaryForm = $formCodesByKey[$qKey][0];
                $allForms = $formCodesByKey[$qKey];

                $remarks[$qKey] = [
                    'remark'        => $defaultRemark.' ('.$field['label'].')',
                    'requested_at'  => now()->toIso8601String(),
                    'status'        => 'pending',
                    'form_code'     => $primaryForm,
                    'form_codes'    => $allForms,
                    'canonical_key' => $field['key'],
                ];
                unset($verified[$qKey]);

                if ($isNew) {
                    $requested++;
                }
            }
        }

        $submission->update([
            'field_remarks'   => $remarks,
            'verified_fields' => $verified,
        ]);

        return [
            'requested_count' => $requested,
            'field_remarks'   => $remarks,
        ];
    }

    /** @return array<string, mixed> */
    private function serializeReadiness(FormReadinessResult $readiness): array
    {
        return [
            'percentage'        => $readiness->percentage,
            'ready'             => $readiness->ready,
            'missing_fields'    => $readiness->missingFields,
            'overflow_warnings' => $readiness->overflowWarnings,
            'blocked_by_overflow' => $readiness->blockedByOverflow,
        ];
    }

    /** @return array<string, mixed> */
    private function serializeSubmission(IrccPackageDocumentSubmission $submission, ?\App\Models\CaseFile $caseFile): array
    {
        $stale = $caseFile
            ? $this->staleDetector->isGenerationStale($submission, $caseFile)
            : false;

        return [
            'id'                 => $submission->id,
            'form_code'          => $submission->governmentFormVersion?->form_code,
            'version_label'      => $submission->governmentFormVersion?->version_label,
            'generated_at'       => $submission->generated_at,
            'generation_status'  => $submission->generation_status,
            'review_status'      => $submission->review_status,
            'source_data_hash'   => $submission->source_data_hash,
            'output_sha256'      => $submission->output_sha256,
            'supersedes_id'      => $submission->supersedes_id,
            'is_stale'           => $stale,
            'download_url'       => null,
        ];
    }
}

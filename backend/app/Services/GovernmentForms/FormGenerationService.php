<?php

namespace App\Services\GovernmentForms;

use App\Contracts\GovernmentForms\GovernmentPdfEngine;
use App\Data\GovernmentForms\FormReadinessResult;
use App\Enums\ClientActivityType;
use App\Enums\GovernmentFormGenerationStatus;
use App\Enums\GovernmentFormGenerationType;
use App\Enums\GovernmentFormReviewStatus;
use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\GovernmentFormVersion;
use App\Models\IrccPackageDocumentSubmission;
use App\Models\User;
use App\Services\ClientActivity\ClientActivityRecorder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FormGenerationService
{
    public function __construct(
        private GovernmentFormAuthorizationService $authorization,
        private ApplicationInfoReviewService $reviewService,
        private GovernmentFormRegistryService $registry,
        private CanonicalDataResolver $canonicalResolver,
        private FormReadinessService $readinessService,
        private FormMappingService $mappingService,
        private XfaDatasetBuilder $datasetBuilder,
        private GovernmentPdfEngine $pdfEngine,
        private PdfStructureValidator $structureValidator,
        private SourceDataHasher $hasher,
        private ClientActivityRecorder $activityRecorder,
    ) {}

    public function readiness(User $consultant, ClientProfile $profile, string $formCode, ?int $caseFileId = null): FormReadinessResult
    {
        $this->authorization->authorizeConsultantForProfile($consultant, $profile);
        $caseFile = $this->authorization->resolveCaseFile($profile, $caseFileId);
        $version = $this->requireActiveVersion($formCode);
        $canonical = $this->canonicalResolver->resolve($caseFile);

        return $this->readinessService->assess($version, $canonical);
    }

    public function readinessLive(User $consultant, ClientProfile $profile, string $formCode, ?int $caseFileId = null): FormReadinessResult
    {
        $this->authorization->authorizeConsultantForProfile($consultant, $profile);
        $caseFile = $this->authorization->resolveCaseFile($profile, $caseFileId);
        $version = $this->requireActiveVersion($formCode);
        $canonical = $this->canonicalResolver->resolveLive($caseFile);

        return $this->readinessService->assess($version, $canonical);
    }

    /**
     * @return array{submission: IrccPackageDocumentSubmission, readiness: FormReadinessResult, stale: bool}
     */
    public function generate(
        User $consultant,
        ClientProfile $profile,
        string $formCode,
        ?int $caseFileId = null,
        bool $allowPartial = false,
    ): array {
        $this->authorization->authorizeConsultantForProfile($consultant, $profile);
        $caseFile = $this->authorization->resolveCaseFile($profile, $caseFileId);

        if (! $this->reviewService->isReviewed($caseFile)) {
            throw new GovernmentFormGenerationException('Application information must be reviewed before generating government forms.');
        }

        $version = $this->requireActiveVersion($formCode);
        $canonical = $this->canonicalResolver->resolve($caseFile);
        $readiness = $this->readinessService->assess($version, $canonical);

        if (! $readiness->ready && ! $allowPartial) {
            $message = $readiness->blockedByOverflow
                ? 'Form exceeds IMM 5406 field capacity. Resolve overflow warnings before generating.'
                : 'Form is not ready for generation. Missing required canonical data.';
            throw new GovernmentFormGenerationException($message);
        }

        $templatePath = $this->registry->resolveTemplateAbsolutePath($version);
        if ($templatePath === null || ! is_file($templatePath)) {
            throw new GovernmentFormGenerationException('Official template is not available in private storage.');
        }

        $templateHash = hash_file('sha256', $templatePath) ?: $version->template_sha256;
        if ($version->template_sha256 && ! hash_equals($version->template_sha256, $templateHash)) {
            throw new GovernmentFormGenerationException('Template hash mismatch. Version requires revalidation.');
        }

        $pdfFields = $this->mappingService->mapToPdfFields($version, $canonical->values);
        if ($pdfFields === []) {
            throw new GovernmentFormGenerationException('No mapped field values available for generation.');
        }

        $formCodeUpper = strtoupper($formCode);
        $formConfig = config('government_forms.supported_forms.'.$formCodeUpper, []);
        $datasetsXml = $this->datasetBuilder->build(
            $formConfig['xfa_root'] ?? 'IMM_5476',
            $pdfFields,
            $formConfig['datasets_skeleton'] ?? null,
        );

        $tempOutput = $this->tempOutputPath($caseFile, $formCode);
        $finalRelativePath = $this->finalStorageRelativePath($caseFile, $formCode, $version);
        $finalAbsolutePath = Storage::disk('local')->path($finalRelativePath);

        try {
            $fillResult = $this->pdfEngine->fillXfaDatasets($templatePath, $datasetsXml, $tempOutput);

            if (strtoupper($formCode) === 'IMM5476') {
                $validation = $this->structureValidator->validateImm5476($templatePath, $fillResult['output_path']);
                if (! $validation['passed']) {
                    throw new GovernmentFormGenerationException('Generated PDF failed structural validation.');
                }
            }

            if (strtoupper($formCode) === 'IMM5406') {
                $validation = $this->structureValidator->validateImm5406($templatePath, $fillResult['output_path']);
                if (! $validation['passed']) {
                    throw new GovernmentFormGenerationException('Generated IMM 5406 PDF failed structural validation.');
                }
            }

            File::ensureDirectoryExists(dirname($finalAbsolutePath));
            if (! rename($fillResult['output_path'], $finalAbsolutePath)) {
                File::copy($fillResult['output_path'], $finalAbsolutePath);
                @unlink($fillResult['output_path']);
            }

            $outputHash = hash_file('sha256', $finalAbsolutePath) ?: '';

            $submission = DB::connection('cws')->transaction(function () use (
                $caseFile,
                $profile,
                $consultant,
                $version,
                $canonical,
                $templateHash,
                $outputHash,
                $finalRelativePath,
                $formCode,
            ) {
                $previous = IrccPackageDocumentSubmission::query()
                    ->where('case_file_id', $caseFile->id)
                    ->where('government_form_version_id', $version->id)
                    ->whereIn('generation_status', [
                        GovernmentFormGenerationStatus::GENERATED->value,
                        GovernmentFormGenerationStatus::NEEDS_REVIEW->value,
                        GovernmentFormGenerationStatus::REVIEWED->value,
                        GovernmentFormGenerationStatus::VALIDATED->value,
                    ])
                    ->latest('id')
                    ->first();

                if ($previous) {
                    $previous->update(['generation_status' => GovernmentFormGenerationStatus::SUPERSEDED]);
                }

                return IrccPackageDocumentSubmission::create([
                    'case_file_id'              => $caseFile->id,
                    'ircc_category_document_id' => null,
                    'uploaded_by'               => $consultant->id,
                    'file_path'                 => $finalRelativePath,
                    'original_filename'         => $this->downloadFilename($formCode, $version),
                    'mime_type'                 => 'application/pdf',
                    'file_size'                 => filesize(Storage::disk('local')->path($finalRelativePath)) ?: null,
                    'status'                    => 'generated',
                    'submitted_at'              => null,
                    'generation_type'           => GovernmentFormGenerationType::AUTO_GENERATED,
                    'government_form_version_id'=> $version->id,
                    'mapping_version'           => $version->mapping_version,
                    'source_template_hash'      => $templateHash,
                    'source_data_hash'          => $canonical->sourceHash,
                    'output_sha256'             => $outputHash,
                    'generated_by'              => $consultant->id,
                    'generated_at'              => now(),
                    'review_status'             => GovernmentFormReviewStatus::NEEDS_REVIEW,
                    'supersedes_id'             => $previous?->id,
                    'generation_status'         => GovernmentFormGenerationStatus::GENERATED,
                    'storage_disk'              => 'local',
                ]);
            });

            $this->activityRecorder->record(
                $profile,
                ClientActivityType::GOVERNMENT_FORM_GENERATED,
                'Government form generated',
                strtoupper($formCode).' generated for case '.$caseFile->case_number,
                $consultant,
                'consultant',
                $caseFile,
                [
                    'form_code'         => strtoupper($formCode),
                    'submission_id'     => $submission->id,
                    'source_data_hash'  => $canonical->sourceHash,
                    'output_sha256'     => $outputHash,
                ],
            );

            return [
                'submission' => $submission->fresh(),
                'readiness'  => $readiness,
                'stale'      => $this->reviewService->isStale($caseFile),
            ];
        } catch (\Throwable $e) {
            @unlink($tempOutput);
            if (isset($finalAbsolutePath) && is_file($finalAbsolutePath)) {
                @unlink($finalAbsolutePath);
            }

            throw $e instanceof GovernmentFormGenerationException
                ? $e
                : GovernmentFormGenerationException::fromThrowable($e);
        }
    }

    public function markReviewed(User $consultant, ClientProfile $profile, IrccPackageDocumentSubmission $submission): IrccPackageDocumentSubmission
    {
        $this->authorization->authorizeConsultantForProfile($consultant, $profile);
        $this->assertSubmissionOwnership($profile, $submission);

        $submission->update([
            'review_status'     => GovernmentFormReviewStatus::REVIEWED,
            'generation_status' => GovernmentFormGenerationStatus::REVIEWED,
        ]);

        $this->activityRecorder->record(
            $profile,
            ClientActivityType::GOVERNMENT_FORM_REVIEWED,
            'Government form reviewed',
            'Generated form marked reviewed by consultant.',
            $consultant,
            'consultant',
            $submission->caseFile,
            ['submission_id' => $submission->id],
        );

        return $submission->fresh();
    }

    /**
     * Build (or reuse) a browser-readable preview PDF.
     * Prefers iText pdfXFA flatten of the official filled form when a license is present;
     * otherwise falls back to a DomPDF values sheet so Preview is never blank.
     */
    public function ensureBrowserPreviewAbsolutePath(
        IrccPackageDocumentSubmission $submission,
        ?array $resolvedFields = null,
    ): string {
        if ($submission->file_path === null) {
            throw new GovernmentFormGenerationException('Generated form file is missing.');
        }

        $diskName = $submission->storage_disk ?: 'local';
        $disk = Storage::disk($diskName);
        $filledAbsolute = $disk->path($submission->file_path);

        if (! is_file($filledAbsolute)) {
            throw new GovernmentFormGenerationException('Generated form file is missing.');
        }

        $previewRelative = preg_replace('/\.pdf$/i', '-browser-preview.pdf', $submission->file_path) ?: ($submission->file_path.'-browser-preview.pdf');
        $previewAbsolute = $disk->path($previewRelative);
        $metaAbsolute = $previewAbsolute.'.meta.json';
        $licenseReady = $this->itextLicenseFileAvailable();

        if (
            is_file($previewAbsolute)
            && filemtime($previewAbsolute) >= filemtime($filledAbsolute)
            && is_file($metaAbsolute)
        ) {
            $meta = json_decode((string) file_get_contents($metaAbsolute), true) ?: [];
            $engine = $meta['engine'] ?? null;
            if ($engine === 'flatten' || ($engine === 'values' && ! $licenseReady)) {
                return $previewAbsolute;
            }
        }

        File::ensureDirectoryExists(dirname($previewAbsolute));
        $tempPreview = $previewAbsolute.'.tmp-'.Str::random(8);
        $flattenError = null;

        try {
            $this->pdfEngine->flattenXfa($filledAbsolute, $tempPreview);
            if (is_file($previewAbsolute)) {
                @unlink($previewAbsolute);
            }
            if (! rename($tempPreview, $previewAbsolute)) {
                File::copy($tempPreview, $previewAbsolute);
                @unlink($tempPreview);
            }
            file_put_contents($metaAbsolute, json_encode([
                'engine' => 'flatten',
                'created_at' => now()->toIso8601String(),
            ]));

            return $previewAbsolute;
        } catch (\Throwable $e) {
            $flattenError = $e->getMessage();
            @unlink($tempPreview);
        }

        $this->writeValuesSheetPreview(
            $previewAbsolute,
            $submission,
            $resolvedFields ?? [],
            $flattenError,
        );
        file_put_contents($metaAbsolute, json_encode([
            'engine' => 'values',
            'created_at' => now()->toIso8601String(),
            'flatten_error' => $flattenError,
        ]));

        return $previewAbsolute;
    }

    private function itextLicenseFileAvailable(): bool
    {
        $candidates = array_filter([
            env('ITEXT_LICENSE_FILE'),
            base_path('../form-processor-poc/java-itext/itextkey.json'),
            dirname(config('government_forms.processor.jar_path')).DIRECTORY_SEPARATOR.'itextkey.json',
        ]);

        foreach ($candidates as $path) {
            if (is_string($path) && $path !== '' && is_file($path)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<array{key?: string, label: string, value: ?string, filled: bool}>  $fields
     */
    private function writeValuesSheetPreview(
        string $previewAbsolute,
        IrccPackageDocumentSubmission $submission,
        array $fields,
        ?string $flattenError,
    ): void {
        $submission->loadMissing('governmentFormVersion');
        $formCode = $submission->governmentFormVersion?->form_code ?? 'FORM';

        $reason = $flattenError ?? 'pdfXFA flatten requires an iText trial/commercial license.';
        if (str_contains(Str::lower($reason), 'pdfxfa is unknown') || str_contains(Str::lower($reason), 'register it')) {
            $reason = 'iText pdfXFA license not loaded (set ITEXT_LICENSE_FILE or place itextkey.json).';
        }

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.government_form_browser_preview', [
            'formCode' => $formCode,
            'fields' => $fields,
            'flattenedUnavailableReason' => $reason,
        ])->setPaper('letter');

        File::ensureDirectoryExists(dirname($previewAbsolute));
        $pdf->save($previewAbsolute);
    }

    public function currentGeneration(CaseFile $caseFile, string $formCode): ?IrccPackageDocumentSubmission
    {
        $version = $this->registry->findActiveVersion($formCode);
        if (! $version) {
            return null;
        }

        return IrccPackageDocumentSubmission::query()
            ->where('case_file_id', $caseFile->id)
            ->where('government_form_version_id', $version->id)
            ->where('generation_type', GovernmentFormGenerationType::AUTO_GENERATED)
            ->whereNotIn('generation_status', [GovernmentFormGenerationStatus::SUPERSEDED, GovernmentFormGenerationStatus::ERROR])
            ->latest('id')
            ->first();
    }

    private function requireActiveVersion(string $formCode): GovernmentFormVersion
    {
        $version = $this->registry->findActiveVersion($formCode);

        if (! $version || ! $version->isGenerationAllowed()) {
            throw new GovernmentFormGenerationException('No verified active version available for '.$formCode.'.');
        }

        return $version;
    }

    private function tempOutputPath(CaseFile $caseFile, string $formCode): string
    {
        $dir = Storage::disk('local')->path(config('government_forms.storage.temp'));

        return $dir.DIRECTORY_SEPARATOR.'gen-'.$caseFile->id.'-'.Str::lower($formCode).'-'.Str::uuid().'.pdf';
    }

    private function finalStorageRelativePath(CaseFile $caseFile, string $formCode, GovernmentFormVersion $version): string
    {
        $filename = Str::lower($formCode).'-'.$version->version_label.'-'.now()->format('Ymd-His').'-'.Str::random(8).'.pdf';

        return config('government_forms.storage.generated').'/'.$caseFile->id.'/'.$filename;
    }

    private function downloadFilename(string $formCode, GovernmentFormVersion $version): string
    {
        return strtoupper($formCode).'-'.$version->version_label.'.pdf';
    }

    private function assertSubmissionOwnership(ClientProfile $profile, IrccPackageDocumentSubmission $submission): void
    {
        $submission->loadMissing('caseFile');

        if ($submission->caseFile?->client_profile_id !== $profile->id) {
            throw new AuthorizationException('Access denied.');
        }

        if (! $submission->isAutoGenerated()) {
            throw new GovernmentFormGenerationException('Submission is not an auto-generated government form.');
        }
    }
}

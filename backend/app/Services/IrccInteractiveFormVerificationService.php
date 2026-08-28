<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\IrccInteractiveForm;
use App\Models\IrccInteractiveFormResponse;

class IrccInteractiveFormVerificationService
{
    /** @return array<string, mixed> */
    public function getVerificationStatus(CaseFile $caseFile): array
    {
        $agreementSigned = $caseFile->isAgreementSigned();

        if (! $agreementSigned) {
            return $this->formatStatus(
                agreementSigned: false,
                totalForms: 0,
                submittedCount: 0,
                reviewedCount: 0,
                verifiedAt: null,
                caseManagementUnlocked: false,
            );
        }

        $categoryId = $caseFile->assigned_ircc_category_id;

        if (! $categoryId) {
            $this->syncVerificationTimestamp($caseFile, true);

            return $this->formatStatus(
                agreementSigned: true,
                totalForms: 0,
                submittedCount: 0,
                reviewedCount: 0,
                verifiedAt: $caseFile->fresh()->application_forms_verified_at,
                caseManagementUnlocked: true,
            );
        }

        $forms = IrccInteractiveForm::where('ircc_category_id', $categoryId)
            ->where('is_active', true)
            ->get();

        if ($forms->isEmpty()) {
            $this->syncVerificationTimestamp($caseFile, true);

            return $this->formatStatus(
                agreementSigned: true,
                totalForms: 0,
                submittedCount: 0,
                reviewedCount: 0,
                verifiedAt: $caseFile->fresh()->application_forms_verified_at,
                caseManagementUnlocked: true,
            );
        }

        $responses = IrccInteractiveFormResponse::where('case_file_id', $caseFile->id)
            ->get()
            ->keyBy('ircc_interactive_form_id');

        $totalForms = $forms->count();
        $submittedCount = 0;
        $reviewedCount = 0;

        foreach ($forms as $form) {
            $response = $responses->get($form->id);

            if ($response && $response->status === 'submitted') {
                $submittedCount++;
            }

            if ($response && $response->reviewed_at) {
                $reviewedCount++;
            }
        }

        $allSubmitted = $submittedCount === $totalForms;
        $allReviewed = $reviewedCount === $totalForms;
        $ready = $allSubmitted && $allReviewed;

        $this->syncVerificationTimestamp($caseFile, $ready);

        return $this->formatStatus(
            agreementSigned: true,
            totalForms: $totalForms,
            submittedCount: $submittedCount,
            reviewedCount: $reviewedCount,
            verifiedAt: $caseFile->fresh()->application_forms_verified_at,
            caseManagementUnlocked: (bool) $caseFile->fresh()->application_forms_verified_at,
        );
    }

    public function syncVerificationComplete(CaseFile $caseFile): void
    {
        $this->getVerificationStatus($caseFile);
    }

    public function isCaseManagementUnlocked(CaseFile $caseFile): bool
    {
        return (bool) ($this->getVerificationStatus($caseFile)['case_management_unlocked'] ?? false);
    }

    public function assertCaseManagementUnlocked(CaseFile $caseFile): void
    {
        if (! $this->isCaseManagementUnlocked($caseFile)) {
            abort(403, 'Case management unlocks after your consultant reviews all application forms.');
        }
    }

    private function syncVerificationTimestamp(CaseFile $caseFile, bool $ready): void
    {
        if ($ready && ! $caseFile->application_forms_verified_at) {
            $caseFile->update(['application_forms_verified_at' => now()]);
        } elseif (! $ready && $caseFile->application_forms_verified_at) {
            $caseFile->update(['application_forms_verified_at' => null]);
        }
    }

    /** @return array<string, mixed> */
    private function formatStatus(
        bool $agreementSigned,
        int $totalForms,
        int $submittedCount,
        int $reviewedCount,
        $verifiedAt,
        bool $caseManagementUnlocked,
    ): array {
        // Before the retainer is signed, forms are not started — never treat
        // "zero forms" as vacuously complete (that made Step 3 show Done early).
        $vacuousComplete = $agreementSigned && $totalForms === 0;

        return [
            'agreement_signed'           => $agreementSigned,
            'total_forms'                => $totalForms,
            'submitted_count'            => $submittedCount,
            'reviewed_count'             => $reviewedCount,
            'all_submitted'              => $vacuousComplete || ($totalForms > 0 && $submittedCount === $totalForms),
            'all_reviewed'               => $vacuousComplete || ($totalForms > 0 && $reviewedCount === $totalForms),
            'verified_at'                => $verifiedAt,
            'case_management_unlocked'   => $caseManagementUnlocked,
        ];
    }
}

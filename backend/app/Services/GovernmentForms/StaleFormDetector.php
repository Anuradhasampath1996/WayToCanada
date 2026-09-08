<?php

namespace App\Services\GovernmentForms;

use App\Models\CaseFile;
use App\Models\IrccPackageDocumentSubmission;

class StaleFormDetector
{
    public function __construct(
        private CanonicalDataResolver $canonicalDataResolver,
    ) {}

    public function isGenerationStale(IrccPackageDocumentSubmission $submission, CaseFile $caseFile): bool
    {
        if ($submission->source_data_hash === null) {
            return false;
        }

        $current = $this->canonicalDataResolver->resolve($caseFile);

        return $current->sourceHash !== $submission->source_data_hash;
    }

    public function isReviewStale(CaseFile $caseFile, ApplicationInfoReviewService $reviewService): bool
    {
        return $reviewService->isStale($caseFile);
    }
}

<?php

namespace App\Services\GovernmentForms;

use App\Enums\ClientActivityType;
use App\Models\CaseFile;
use App\Models\User;
use App\Services\ClientActivity\ClientActivityRecorder;
use Illuminate\Support\Facades\DB;

class ApplicationInfoReviewService
{
    public function __construct(
        private CaseQuestionnaireSnapshotService $snapshotService,
        private SourceDataHasher $hasher,
        private ClientActivityRecorder $activityRecorder,
    ) {}

    public function isReviewed(CaseFile $caseFile): bool
    {
        return $caseFile->application_info_reviewed_at !== null;
    }

    public function canReview(CaseFile $caseFile, User $consultant): bool
    {
        return $caseFile->consultant_id === $consultant->id;
    }

    public function markReviewed(CaseFile $caseFile, User $consultant): CaseFile
    {
        if (! $this->canReview($caseFile, $consultant)) {
            throw new \Illuminate\Auth\Access\AuthorizationException('Consultant is not authorized to review this case.');
        }

        return DB::connection('cws')->transaction(function () use ($caseFile, $consultant) {
            $caseFile->loadMissing('clientProfile');
            $snapshot = $this->snapshotService->buildSnapshot($caseFile);
            $snapshotHash = $this->hasher->hash($snapshot);

            $caseFile->update([
                'application_info_reviewed_at'  => now(),
                'application_info_reviewed_by'  => $consultant->id,
                'questionnaire_snapshot'        => $snapshot,
                'questionnaire_snapshot_hash'   => $snapshotHash,
                'questionnaire_snapshot_at'     => now(),
            ]);

            if ($caseFile->clientProfile) {
                $this->activityRecorder->record(
                    $caseFile->clientProfile,
                    ClientActivityType::APPLICATION_INFO_REVIEWED,
                    'Application information reviewed',
                    'Consultant reviewed application information for government form generation.',
                    $consultant,
                    'consultant',
                    $caseFile,
                    ['questionnaire_snapshot_hash' => $snapshotHash],
                );
            }

            return $caseFile->fresh();
        });
    }

    public function isStale(CaseFile $caseFile): bool
    {
        if (! $this->isReviewed($caseFile) || $caseFile->questionnaire_snapshot_hash === null) {
            return false;
        }

        $currentSnapshot = $this->snapshotService->buildSnapshot($caseFile);
        $currentHash = $this->hasher->hash($currentSnapshot);

        return $currentHash !== $caseFile->questionnaire_snapshot_hash;
    }
}

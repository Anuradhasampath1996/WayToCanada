<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use App\Support\CaseWorkflowStatus;

class CaseAssessmentGateService
{
    public function __construct(
        private CaseHistoryRecorder $history,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(CaseFile $caseFile): array
    {
        $submission = $this->submissionFor($caseFile);
        $fields = $this->requiredFields($submission);
        $missing = array_values(array_filter($fields, static fn (array $f) => ! $f['present']));
        $consultationDone = $this->consultationSatisfied($caseFile);
        $profileReviewed = $caseFile->profile_reviewed_at !== null;
        $canReview = $missing === [];
        $canSelect = $consultationDone && $profileReviewed && $canReview;

        $blockers = [];
        if (! $consultationDone) {
            $blockers[] = 'Initial consultation must be completed or skipped with a reason.';
        }
        if (! $canReview) {
            $blockers[] = 'Required identity/core profile fields are incomplete.';
        } elseif (! $profileReviewed) {
            $blockers[] = 'Consultant must mark the profile as reviewed.';
        }

        return [
            'consultation' => [
                'completed_at' => $caseFile->consultation_completed_at?->toIso8601String(),
                'skipped_at' => $caseFile->consultation_skipped_at?->toIso8601String(),
                'skip_reason' => $caseFile->consultation_skip_reason,
                'notes' => $caseFile->consultation_notes,
                'satisfied' => $consultationDone,
            ],
            'profile_review' => [
                'reviewed_at' => $caseFile->profile_reviewed_at?->toIso8601String(),
                'can_review' => $canReview,
                'required_fields' => $fields,
                'missing_fields' => $missing,
            ],
            'maple_recommendation' => $caseFile->maple_recommendation,
            'maple_recommended_at' => $caseFile->maple_recommended_at?->toIso8601String(),
            'can_select_pathway' => $canSelect,
            'can_open_assessment' => true,
            'blockers' => $blockers,
            'workflow' => CaseWorkflowStatus::serialize($caseFile->workflow_status, $caseFile->status),
        ];
    }

    public function assertCanSelectPathway(CaseFile $caseFile): void
    {
        $state = $this->serialize($caseFile);
        if ($state['can_select_pathway']) {
            return;
        }

        throw new \RuntimeException(implode(' ', $state['blockers']));
    }

    public function completeConsultation(CaseFile $caseFile, User $actor, ?string $notes = null): CaseFile
    {
        $caseFile->update([
            'consultation_completed_at' => now(),
            'consultation_skipped_at' => null,
            'consultation_skip_reason' => null,
            'consultation_notes' => $notes,
            'workflow_status' => $this->advanceWorkflow($caseFile, CaseWorkflowStatus::PROFILE_REVIEW),
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'consultation_completed',
            'Initial consultation completed',
            $notes,
            $actor,
        );

        return $caseFile->fresh();
    }

    public function skipConsultation(CaseFile $caseFile, User $actor, string $reason): CaseFile
    {
        $reason = trim($reason);
        if (mb_strlen($reason) < 8) {
            throw new \RuntimeException('A recorded reason is required to skip the initial consultation.');
        }

        $caseFile->update([
            'consultation_skipped_at' => now(),
            'consultation_skip_reason' => $reason,
            'consultation_completed_at' => null,
            'workflow_status' => $this->advanceWorkflow($caseFile, CaseWorkflowStatus::PROFILE_REVIEW),
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'consultation_skipped',
            'Initial consultation skipped',
            $reason,
            $actor,
            ['reason' => $reason],
        );

        return $caseFile->fresh();
    }

    public function markProfileReviewed(CaseFile $caseFile, User $actor): CaseFile
    {
        $state = $this->serialize($caseFile);
        if (! $state['profile_review']['can_review']) {
            $labels = collect($state['profile_review']['missing_fields'])->pluck('label')->implode(', ');
            throw new \RuntimeException('Cannot mark profile reviewed. Missing: '.$labels);
        }

        $caseFile->update([
            'profile_reviewed_at' => now(),
            'workflow_status' => $this->advanceWorkflow($caseFile, CaseWorkflowStatus::ELIGIBILITY_ASSESSMENT),
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'profile_reviewed',
            'Required identity/core profile fields reviewed',
            null,
            $actor,
        );

        return $caseFile->fresh();
    }

    /**
     * @return list<array{key: string, label: string, present: bool}>
     */
    public function requiredFields(?QuestionnaireSubmission $submission): array
    {
        $main = is_array($submission?->main_data) ? $submission->main_data : [];
        $step1 = is_array($submission?->step1_data) ? $submission->step1_data : [];

        $name = $this->firstFilled([
            $main['passportFullName'] ?? null,
            $main['fullName'] ?? null,
            $step1['fullName'] ?? null,
        ]);
        $workOrStudy = $this->firstFilled([
            $main['workExperience'] ?? null,
            $main['canadianWork'] ?? null,
            $main['studiedInCanada'] ?? null,
            $main['foreignWorkEntries'] ?? null,
        ]);

        return [
            ['key' => 'name', 'label' => 'Full name', 'present' => $this->filled($name)],
            ['key' => 'dob', 'label' => 'Date of birth', 'present' => $this->filled($main['dob'] ?? null)],
            ['key' => 'passport', 'label' => 'Passport number', 'present' => $this->filled($main['passportNumber'] ?? null)],
            ['key' => 'education', 'label' => 'Education', 'present' => $this->filled($main['educationLevels'] ?? null)],
            ['key' => 'language', 'label' => 'Language test', 'present' => $this->filled($main['languageTest'] ?? null) || $this->filled($main['scores'] ?? null)],
            ['key' => 'work_or_study', 'label' => 'Work or Canadian study', 'present' => $this->filled($workOrStudy)],
        ];
    }

    public function submissionFor(CaseFile $caseFile): ?QuestionnaireSubmission
    {
        $caseFile->loadMissing('clientProfile');
        $userId = $caseFile->clientProfile?->user_id;
        if (! $userId) {
            return null;
        }

        return QuestionnaireSubmission::query()
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->first();
    }

    private function consultationSatisfied(CaseFile $caseFile): bool
    {
        if ($caseFile->consultation_completed_at) {
            return true;
        }

        return $caseFile->consultation_skipped_at !== null
            && filled($caseFile->consultation_skip_reason);
    }

    private function advanceWorkflow(CaseFile $caseFile, string $minimum): string
    {
        $current = CaseWorkflowStatus::resolveForCase($caseFile->workflow_status, $caseFile->status);
        $currentOrder = CaseWorkflowStatus::ORDER[$current] ?? 0;
        $minOrder = CaseWorkflowStatus::ORDER[$minimum] ?? 0;

        return $currentOrder >= $minOrder ? $current : $minimum;
    }

    /**
     * @param  list<mixed>  $values
     */
    private function firstFilled(array $values): mixed
    {
        foreach ($values as $value) {
            if ($this->filled($value)) {
                return $value;
            }
        }

        return null;
    }

    private function filled(mixed $value): bool
    {
        if (is_array($value)) {
            return $value !== [];
        }

        return trim((string) $value) !== '';
    }
}

<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\User;
use App\Support\CaseWorkflowStatus;
use Illuminate\Http\UploadedFile;

class CaseDecisionService
{
    public const STATUSES = [
        'approved' => 'Approved',
        'refused' => 'Refused',
        'withdrawn' => 'Withdrawn',
        'other' => 'Other',
    ];

    public function __construct(private CaseHistoryRecorder $history) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(CaseFile $caseFile): array
    {
        return [
            'statuses' => self::STATUSES,
            'decision_status' => $caseFile->decision_status,
            'decision_at' => $caseFile->decision_at?->toIso8601String(),
            'decision_note' => $caseFile->decision_note,
            'next_step_note' => $caseFile->next_step_note,
            'has_letter' => (bool) $caseFile->decision_letter_path,
            'workflow' => CaseWorkflowStatus::serialize($caseFile->workflow_status, $caseFile->status),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function record(CaseFile $caseFile, User $actor, array $data, ?UploadedFile $letter = null): CaseFile
    {
        if (! $caseFile->submitted_at && $caseFile->status !== 'APPLICATION_SUBMITTED') {
            throw new \RuntimeException('A decision can be recorded only after the case is submitted.');
        }

        if ($caseFile->decision_status) {
            throw new \RuntimeException('A decision is already recorded. Decision records are not overwritten.');
        }

        if (($data['decision_status'] ?? null) === 'other' && blank($data['decision_note'] ?? null)) {
            throw new \RuntimeException('Describe the custom decision.');
        }

        $letterPath = $caseFile->decision_letter_path;
        if ($letter) {
            $letterPath = $letter->store('private/case-decisions/'.$caseFile->id, 'local');
        }

        $caseFile->update([
            'decision_status' => $data['decision_status'],
            'decision_at' => now(),
            'decision_note' => $data['decision_note'] ?? null,
            'next_step_note' => $data['next_step_note'] ?? null,
            'decision_letter_path' => $letterPath,
            'workflow_status' => CaseWorkflowStatus::DECISION_RECEIVED,
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'decision_recorded',
            'Decision recorded: '.self::STATUSES[$data['decision_status']],
            $data['decision_note'] ?? null,
            $actor,
            [
                'decision_status' => $data['decision_status'],
                'next_step_note' => $data['next_step_note'] ?? null,
                'has_letter' => (bool) $letterPath,
            ],
        );

        return $caseFile->fresh();
    }
}

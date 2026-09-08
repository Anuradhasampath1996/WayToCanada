<?php

namespace App\Services\GovernmentForms;

use App\Models\CaseFile;
use App\Models\QuestionnaireSubmission;
use App\Support\QuestionnaireStep3Data;

class CaseQuestionnaireSnapshotService
{
    /**
     * Build a frozen questionnaire subset for case-scoped generation.
     *
     * @return array<string, mixed>
     */
    public function buildSnapshot(CaseFile $caseFile): array
    {
        $caseFile->loadMissing('clientProfile.user');
        $user = $caseFile->clientProfile?->user;

        if (! $user) {
            return [];
        }

        $submission = QuestionnaireSubmission::where('user_id', $user->id)->first();

        if (! $submission) {
            return [
                'user_id' => $user->id,
                'captured_at' => now()->toIso8601String(),
            ];
        }

        return [
            'user_id'                        => $user->id,
            'questionnaire_submission_id'    => $submission->id,
            'questionnaire_updated_at'       => $submission->updated_at?->toIso8601String(),
            'step1_data'                     => $submission->step1_data,
            'main_data'                      => $submission->main_data,
            'spouse_data'                    => $submission->spouse_data,
            'children_data'                  => $submission->children_data,
            'accompanying_data'              => $submission->accompanying_data,
            'step3_data'                     => QuestionnaireStep3Data::resolve($submission),
            'captured_at'                    => now()->toIso8601String(),
            'case_file_id'                   => $caseFile->id,
        ];
    }
}

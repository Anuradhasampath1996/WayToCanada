<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;

class WorkspaceCaseDetailService
{
    public function __construct(
        private QuestionnaireCrsBridgeService $crsBridge,
    ) {}

    /** @return array<string, mixed> */
    public function build(ClientProfile $profile, CaseFile $caseFile, ?QuestionnaireSubmission $submission): array
    {
        $step1 = $submission?->step1_data ?? null;
        $main  = $submission?->main_data ?? null;

        return [
            'questionnaire' => $submission ? [
                'is_submitted'    => (bool) $submission->is_submitted,
                'submitted_at'    => optional($submission->submitted_at)?->toIso8601String(),
                'step1_data'      => $this->sanitizeSection(is_array($step1) ? $step1 : null),
                'main_data'       => $this->sanitizeSection(is_array($main) ? $main : null),
                'spouse_data'     => $this->sanitizeSection(is_array($submission->spouse_data) ? $submission->spouse_data : null),
                'children_data'   => $this->sanitizeList($submission->children_data),
                'accompanying_data' => $this->sanitizeList($submission->accompanying_data),
                'verified_fields' => $submission->verified_fields ?? [],
                'field_remarks'   => $submission->field_remarks ?? [],
            ] : null,
            'pathway_assessment' => [
                'notes'    => $caseFile->pathway_assessment_notes,
                'snapshot' => $caseFile->pathway_assessment_snapshot ?? [],
                'crs_score'=> $caseFile->pathway_assessment_crs_score,
                'ircc_crs' => $caseFile->pathway_assessment_ircc_crs_score,
                'rules_version' => $caseFile->pathway_assessment_rules_version,
                'assessed_at'=> optional($caseFile->pathway_assessment_at)?->toIso8601String(),
            ],
            'crs_estimate' => $this->crsBridge->estimateFromSubmission($submission),
            'profile' => [
                'immigration_pathway' => $profile->immigration_pathway,
            ],
        ];
    }

    /** @param  array<string, mixed>|null  $data
     * @return array<string, mixed>|null
     */
    private function sanitizeSection(?array $data): ?array
    {
        if ($data === null) {
            return null;
        }

        $out = [];
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $out[$key] = $this->sanitizeSection($value);

                continue;
            }

            if (is_string($value) && $this->isSensitivePath($key, $value)) {
                $out[$key] = '[document on file]';

                continue;
            }

            $out[$key] = $value;
        }

        return $out;
    }

    /** @param  mixed  $list
     * @return list<array<string, mixed>|null>|null
     */
    private function sanitizeList($list): ?array
    {
        if (! is_array($list)) {
            return null;
        }

        return array_map(
            fn ($item) => is_array($item) ? $this->sanitizeSection($item) : $item,
            $list,
        );
    }

    private function isSensitivePath(string $key, string $value): bool
    {
        if (str_contains($value, 's3://') || str_contains($value, 'amazonaws.com')) {
            return true;
        }

        if (preg_match('/\.(pdf|jpg|jpeg|png|heic|webp)$/i', $value)) {
            return true;
        }

        return (bool) preg_match('/(scan|upload|path|file|document|photo)/i', $key);
    }
}

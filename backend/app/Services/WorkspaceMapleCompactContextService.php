<?php

namespace App\Services;

final class WorkspaceMapleCompactContextService
{
    /**
     * Token-efficient case pack for live chat — keeps facts, drops bulky questionnaire dumps.
     *
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    public function forChat(array $context): array
    {
        $detail = is_array($context['case_detail'] ?? null) ? $context['case_detail'] : [];
        $crs    = $detail['crs_estimate'] ?? null;

        return [
            'client' => $context['client'] ?? null,
            'case_file' => [
                'status'              => $context['case_file']['status'] ?? null,
                'immigration_pathway' => $context['case_file']['immigration_pathway'] ?? null,
                'agreement_signed_at' => $context['case_file']['agreement_signed_at'] ?? null,
                'pathway_assessment_crs_score'      => $context['case_file']['pathway_assessment_crs_score'] ?? null,
                'pathway_assessment_ircc_crs_score' => $context['case_file']['pathway_assessment_ircc_crs_score'] ?? null,
                'pathway_assessment_notes'          => $context['case_file']['pathway_assessment_notes'] ?? null,
            ],
            'case_facts'            => $context['case_facts'] ?? [],
            'questionnaire'         => $context['questionnaire'] ?? [],
            'questionnaire_gaps'    => array_slice($context['questionnaire_gaps'] ?? [], 0, 12),
            'inadmissibility_flags' => $context['inadmissibility_flags'] ?? [],
            'forms_verification'    => $this->compactForms($context['forms_verification'] ?? []),
            'pathway_snapshot_summary' => $context['pathway_snapshot_summary'] ?? [],
            'next_action'           => $context['next_action'] ?? [],
            'workflow_phase'        => $context['workflow_phase'] ?? null,
            'pathway_focus'         => (bool) ($context['pathway_focus'] ?? false),
            'pathway_review_mode'   => (bool) ($context['pathway_review_mode'] ?? false),
            'crs_estimate'          => is_array($crs) ? [
                'crs_total'      => $crs['crs_total'] ?? null,
                'rules_version'  => $crs['rules_version'] ?? null,
                'breakdown_hint' => $crs['breakdown_summary'] ?? null,
            ] : null,
            'pathway_assessment_notes' => $detail['pathway_assessment']['notes'] ?? null,
            'questionnaire_highlights' => $this->questionnaireHighlights($detail),
        ];
    }

    /** @param array<string, mixed> $forms */
    private function compactForms(array $forms): array
    {
        return [
            'total_forms'              => $forms['total_forms'] ?? 0,
            'submitted_count'          => $forms['submitted_count'] ?? 0,
            'reviewed_count'           => $forms['reviewed_count'] ?? 0,
            'all_submitted'            => $forms['all_submitted'] ?? false,
            'all_reviewed'             => $forms['all_reviewed'] ?? false,
            'case_management_unlocked' => $forms['case_management_unlocked'] ?? false,
        ];
    }

    /** @param array<string, mixed> $detail */
    private function questionnaireHighlights(array $detail): array
    {
        $main  = is_array($detail['questionnaire']['main_data'] ?? null) ? $detail['questionnaire']['main_data'] : [];
        $step1 = is_array($detail['questionnaire']['step1_data'] ?? null) ? $detail['questionnaire']['step1_data'] : [];

        return array_filter([
            'visa_type'         => $step1['visaType'] ?? $main['visaType'] ?? null,
            'studied_in_canada' => $main['studiedInCanada'] ?? null,
            'canadian_work'     => $main['canadianWork'] ?? null,
            'language_test'     => $main['languageTestType'] ?? null,
            'target_noc'        => $main['intendedNocCode'] ?? null,
            'work_experience'   => $main['workExperience'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
    }
}

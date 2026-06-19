<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;

class WorkspaceCaseRulesService
{
    /** @return array<string, mixed> */
    public function buildContextPack(ClientProfile $profile, CaseFile $caseFile, ?QuestionnaireSubmission $submission, array $verification): array
    {
        $qStats = $this->questionnaireStats($submission);
        $gaps   = $this->questionnaireGaps($submission);
        $flags  = $this->inadmissibilityFlags($submission);

        $nextAction = $this->resolveNextAction($profile->id, $caseFile, $qStats, $verification);

        $snapshot = $caseFile->pathway_assessment_snapshot ?? [];

        return [
            'client' => [
                'id'    => $profile->id,
                'name'  => $profile->user?->name,
                'email' => $profile->user?->email,
            ],
            'case_facts' => $this->buildCaseFacts($profile, $submission),
            'case_file' => [
                'id'                  => $caseFile->id,
                'status'              => $caseFile->status,
                'immigration_pathway' => $caseFile->immigration_pathway,
                'agreement_sent_at'   => optional($caseFile->agreement_sent_at)?->toIso8601String(),
                'agreement_signed_at' => optional($caseFile->agreement_signed_at)?->toIso8601String(),
                'pathway_assessment_at' => optional($caseFile->pathway_assessment_at)?->toIso8601String(),
                'pathway_assessment_crs_score'      => $caseFile->pathway_assessment_crs_score,
                'pathway_assessment_ircc_crs_score' => $caseFile->pathway_assessment_ircc_crs_score,
                'pathway_assessment_notes'          => $caseFile->pathway_assessment_notes,
                'pathway_assessment_rules_version'  => $caseFile->pathway_assessment_rules_version,
            ],
            'questionnaire' => $qStats,
            'questionnaire_gaps' => $gaps,
            'inadmissibility_flags' => $flags,
            'forms_verification' => $verification,
            'pathway_snapshot_summary' => $this->summarizePathwaySnapshot($snapshot),
            'next_action' => $nextAction,
            'pathway_focus' => $this->isPathwayFocusStage($caseFile, $qStats, $verification),
        ];
    }

    /** @return array<string, mixed> */
    private function buildCaseFacts(ClientProfile $profile, ?QuestionnaireSubmission $submission): array
    {
        $step1 = $submission?->step1_data ?? [];
        $main  = $submission?->main_data ?? [];
        $spouse = $submission?->spouse_data ?? [];

        $mainFullName = trim((string) (
            $main['fullName']
            ?? $main['passportFullName']
            ?? $step1['fullName']
            ?? ''
        ));
        $accountName = trim((string) ($profile->user?->name ?? ''));
        $displayName = $mainFullName !== '' ? $mainFullName : ($accountName !== '' ? $accountName : null);
        $nameSource  = $mainFullName !== ''
            ? 'questionnaire main applicant profile'
            : ($accountName !== '' ? 'client portal account' : null);

        $spouseName = trim((string) ($spouse['fullName'] ?? $spouse['passportFullName'] ?? ''));
        $married    = strtolower((string) ($step1['married'] ?? '')) === 'yes';

        return [
            'account' => array_filter([
                'name'  => $accountName ?: null,
                'email' => $profile->user?->email,
                'phone' => $profile->user?->phone,
            ], fn ($v) => $v !== null && $v !== ''),
            'main_applicant' => array_filter([
                'display_name'      => $displayName,
                'full_name'         => $mainFullName ?: null,
                'passport_full_name'=> $main['passportFullName'] ?? null,
                'name_source'       => $nameSource,
                'email'             => $step1['email'] ?? $profile->user?->email,
                'whatsapp'          => $main['whatsapp'] ?? $step1['whatsapp'] ?? null,
                'phone'             => $step1['phone'] ?? $profile->user?->phone,
                'date_of_birth'     => $main['dob'] ?? $main['passportDob'] ?? null,
                'passport_number'   => $main['passportNumber'] ?? null,
                'nationality'       => $main['passportNationality'] ?? $main['citizenship'] ?? null,
            ], fn ($v) => $v !== null && $v !== ''),
            'spouse' => array_filter([
                'display_name' => $spouseName ?: null,
                'full_name'    => $spouseName ?: null,
            ], fn ($v) => $v !== null && $v !== ''),
            'married' => $married,
            'questionnaire_submitted_at' => optional($submission?->submitted_at)?->format('M j, Y'),
        ];
    }

    /** @return array<string, mixed> */
    private function questionnaireStats(?QuestionnaireSubmission $submission): array
    {
        if (! $submission) {
            return [
                'has_submission'  => false,
                'is_submitted'    => false,
                'submitted_at'    => null,
                'verified_count'  => 0,
                'pending_refills' => 0,
                'has_main_profile'=> false,
            ];
        }

        $remarks = $submission->field_remarks ?? [];
        $pending = collect($remarks)->filter(fn ($r) => ($r['status'] ?? '') === 'pending')->count();

        return [
            'has_submission'   => true,
            'is_submitted'     => (bool) $submission->is_submitted,
            'submitted_at'     => optional($submission->submitted_at)?->toIso8601String(),
            'verified_count'   => count($submission->verified_fields ?? []),
            'pending_refills'  => $pending,
            'has_main_profile' => ! empty($submission->main_data),
        ];
    }

    /** @return list<array{id: string, label: string, severity: string}> */
    private function questionnaireGaps(?QuestionnaireSubmission $submission): array
    {
        if (! $submission) {
            return [['id' => 'no_submission', 'label' => 'Client has not started the questionnaire', 'severity' => 'error']];
        }

        $step1  = $submission->step1_data ?? [];
        $main   = $submission->main_data ?? [];
        $spouse = $submission->spouse_data ?? [];
        $married = strtolower((string) ($step1['married'] ?? '')) === 'yes';

        $checks = [
            ['ok' => ! empty($main['dob']), 'id' => 'dob', 'label' => 'Main applicant — date of birth', 'severity' => 'error'],
            ['ok' => ! empty($main['educationLevels']), 'id' => 'edu', 'label' => 'Main applicant — education level', 'severity' => 'error'],
            [
                'ok' => strtolower((string) ($main['languageTest'] ?? '')) === 'yes'
                    && collect((array) ($main['scores'] ?? []))->filter()->isNotEmpty(),
                'id' => 'english',
                'label' => 'Main applicant — English test scores',
                'severity' => 'error',
            ],
            ['ok' => ! empty($main['workExperience']), 'id' => 'fwe', 'label' => 'Main applicant — foreign work experience', 'severity' => 'error'],
            ['ok' => ! empty($main['intendedNocCode']), 'id' => 'noc', 'label' => 'Main applicant — target NOC code', 'severity' => 'warn'],
        ];

        if ($married) {
            $checks[] = ['ok' => ! empty($spouse['dob']), 'id' => 'sp-dob', 'label' => 'Spouse — date of birth', 'severity' => 'warn'];
            $checks[] = ['ok' => ! empty($spouse['educationLevels']), 'id' => 'sp-edu', 'label' => 'Spouse — education level', 'severity' => 'warn'];
        }

        return collect($checks)
            ->filter(fn ($c) => ! $c['ok'])
            ->map(fn ($c) => ['id' => $c['id'], 'label' => $c['label'], 'severity' => $c['severity']])
            ->values()
            ->all();
    }

    /** @return list<array{level: string, text: string}> */
    private function inadmissibilityFlags(?QuestionnaireSubmission $submission): array
    {
        if (! $submission) {
            return [];
        }

        $step3 = $submission->accompanying_data['step3'] ?? $submission->step1_data ?? [];
        if (! is_array($step3)) {
            $step3 = [];
        }

        $flags = [];
        if (strtolower((string) ($step3['hasCriminalRecord'] ?? '')) === 'yes') {
            $flags[] = ['level' => 'warn', 'text' => 'Criminal record disclosed — review admissibility before recommending a pathway.'];
        }
        if (strtolower((string) ($step3['hasVisaRefusal'] ?? '')) === 'yes') {
            $flags[] = ['level' => 'warn', 'text' => 'Previous visa refusal — document strategy may be required.'];
        }
        if (strtolower((string) ($step3['hasMedicalCondition'] ?? '')) === 'yes') {
            $flags[] = ['level' => 'warn', 'text' => 'Medical condition disclosed — medical exam may be required.'];
        }

        return $flags;
    }

    /** @param array<string, mixed> $qStats @param array<string, mixed> $verification */
    private function resolveNextAction(int $profileId, CaseFile $caseFile, array $qStats, array $verification): array
    {
        $base = "/dashboard/clients/{$profileId}/workspace";

        if (($qStats['pending_refills'] ?? 0) > 0) {
            $n = $qStats['pending_refills'];
            return $this->action('warning', "{$n} refill request(s) pending", 'Client must correct flagged questionnaire fields.', "{$base}/questionnaire-review", 'Open questionnaire review');
        }

        if (! ($qStats['has_submission'] ?? false) || ! ($qStats['is_submitted'] ?? false)) {
            $desc = ($qStats['has_main_profile'] ?? false)
                ? 'Client started profile but has not submitted. Review partial answers or fill gaps.'
                : 'Ask client to complete and submit immigration questionnaire before pathway assessment.';
            return $this->action('warning', 'Waiting for client questionnaire', $desc, "{$base}/questionnaire-review", 'Open questionnaire review');
        }

        if (($qStats['verified_count'] ?? 0) < 5) {
            $count = $qStats['verified_count'] ?? 0;
            return $this->action('info', 'Review client questionnaire', "Only {$count} field(s) verified. Verify identity and key answers before pathway assignment.", "{$base}/questionnaire-review", 'Verify questionnaire');
        }

        if (! $caseFile->immigration_pathway) {
            return $this->action('primary', 'Assign immigration pathway', 'Questionnaire is ready. Run CRS/pathway analysis and assign the best route for this client.', "{$base}/pathway-calculator", 'Open pathway calculator', true);
        }

        if (! $caseFile->agreement_sent_at) {
            return $this->action('primary', 'Create retainer agreement', "{$caseFile->immigration_pathway} is assigned. Build and send retainer for client signature.", "{$base}/retainer-agreement", 'Create agreement');
        }

        if (! $caseFile->agreement_signed_at) {
            $sent = optional($caseFile->agreement_sent_at)?->format('M j, Y') ?? '—';
            return $this->action('warning', 'Awaiting client signature', "Agreement sent on {$sent}. Follow up if unsigned.", "{$base}/retainer-agreement", 'Manage agreement');
        }

        $total = (int) ($verification['total_forms'] ?? 0);
        if ($total > 0) {
            if (! ($verification['all_submitted'] ?? false)) {
                $sub = (int) ($verification['submitted_count'] ?? 0);
                return $this->action('warning', 'Waiting for application forms', "{$sub}/{$total} forms submitted by client.");
            }
            if (! ($verification['all_reviewed'] ?? false)) {
                return $this->action('info', 'Review client application forms', 'All forms submitted. Mark each reviewed to unlock case management.', $base, 'Review forms on workspace');
            }
        }

        if ($verification['case_management_unlocked'] ?? false) {
            return $this->action('success', 'Case hub is ready', 'Manage documents, pipeline, and communication in the case hub.', "{$base}/case-management", 'Open case hub');
        }

        return $this->action('info', 'Continue case workflow', 'Work through workspace steps toward submission.', $base, 'View workspace');
    }

    /** @return array<string, mixed> */
    private function action(string $tone, string $title, string $description, ?string $href = null, ?string $buttonLabel = null, bool $pathwayFocus = false): array
    {
        return array_filter([
            'tone'          => $tone,
            'title'         => $title,
            'description'   => $description,
            'href'          => $href,
            'button_label'  => $buttonLabel,
            'pathway_focus' => $pathwayFocus,
        ], fn ($v) => $v !== null);
    }

    /** @param array<string, mixed> $qStats @param array<string, mixed> $verification */
    private function isPathwayFocusStage(CaseFile $caseFile, array $qStats, array $verification): bool
    {
        if ($caseFile->immigration_pathway) {
            return false;
        }

        return ($qStats['is_submitted'] ?? false)
            && ($qStats['verified_count'] ?? 0) >= 5
            && ($qStats['pending_refills'] ?? 0) === 0;
    }

    /** @param array<string, mixed> $snapshot */
    private function summarizePathwaySnapshot(array $snapshot): array
    {
        if ($snapshot === []) {
            return ['has_snapshot' => false];
        }

        $insights = collect($snapshot['pathway_insights'] ?? $snapshot['insights'] ?? [])
            ->take(6)
            ->map(fn ($i) => is_array($i) ? [
                'pathway'  => $i['pathway'] ?? $i['name'] ?? null,
                'eligible' => $i['eligible'] ?? $i['status'] ?? null,
                'note'     => $i['note'] ?? $i['summary'] ?? null,
            ] : null)
            ->filter()
            ->values()
            ->all();

        return [
            'has_snapshot' => true,
            'crs_score'    => $snapshot['crs_score'] ?? $snapshot['total_score'] ?? null,
            'insights'     => $insights,
        ];
    }
}

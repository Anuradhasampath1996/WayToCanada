<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\DocumentSubmission;
use App\Models\IrccInteractiveFormResponse;
use App\Support\DocumentWorkflowStatus;

/**
 * Decision-support highlights only. Never marks a checklist item or approves a case.
 */
class CaseInconsistencyHighlighter
{
    public function __construct(
        private CaseRequirementPlanService $plans,
        private CaseProfileFactsResolver $facts,
    ) {}

    /**
     * @return list<array{code: string, severity: string, message: string, fields: list<string>}>
     */
    public function highlights(CaseFile $caseFile): array
    {
        $highlights = [];
        $caseFile->loadMissing('clientProfile.user');
        $submission = $this->facts->submissionFor($caseFile);
        $main = is_array($submission?->main_data) ? $submission->main_data : [];
        $plan = $this->plans->currentPlan($caseFile);
        $snapshot = $plan?->snapshot ?? [];

        $passportName = trim((string) ($main['passportFullName'] ?? ''));
        $profileName = trim((string) ($caseFile->clientProfile?->user?->name ?? ''));
        if ($passportName !== '' && $profileName !== '' && $this->normalize($passportName) !== $this->normalize($profileName)) {
            $highlights[] = [
                'code' => 'name_mismatch',
                'severity' => 'warning',
                'message' => 'Passport name and portal account name do not match. Confirm they belong to the same person.',
                'fields' => ['passportFullName', 'user.name'],
            ];
        }

        if (trim((string) ($main['dob'] ?? '')) === '') {
            $highlights[] = [
                'code' => 'missing_dob',
                'severity' => 'warning',
                'message' => 'Date of birth is missing from the intake profile.',
                'fields' => ['dob'],
            ];
        }

        $work = $main['workHistory'] ?? $main['work_history'] ?? [];
        if (is_array($work)) {
            $ranges = [];
            foreach ($work as $entry) {
                if (! is_array($entry)) {
                    continue;
                }
                $start = $this->dateOrNull($entry['startDate'] ?? $entry['start'] ?? null);
                $end = $this->dateOrNull($entry['endDate'] ?? $entry['end'] ?? null) ?? now()->toDateString();
                if ($start) {
                    $ranges[] = [$start, $end];
                }
            }
            for ($i = 0; $i < count($ranges); $i++) {
                for ($j = $i + 1; $j < count($ranges); $j++) {
                    if ($ranges[$i][0] <= $ranges[$j][1] && $ranges[$j][0] <= $ranges[$i][1]) {
                        $highlights[] = [
                            'code' => 'work_date_overlap',
                            'severity' => 'info',
                            'message' => 'Work history dates appear to overlap. Confirm the employment timeline.',
                            'fields' => ['workHistory'],
                        ];
                        break 2;
                    }
                }
            }
        }

        $pendingFields = array_values(array_filter(
            $snapshot['extra_fields'] ?? [],
            fn ($field) => is_array($field) && ($field['status'] ?? '') === 'pending',
        ));
        if ($pendingFields !== []) {
            $highlights[] = [
                'code' => 'extra_fields_pending',
                'severity' => 'info',
                'message' => count($pendingFields).' pathway extra field(s) are still unanswered.',
                'fields' => array_values(array_filter(array_map(fn ($field) => $field['key'] ?? null, $pendingFields))),
            ];
        }

        $unverified = [];
        foreach ($snapshot['documents'] ?? [] as $doc) {
            if (! is_array($doc) || ($doc['status'] ?? '') === 'obsolete' || ($doc['status'] ?? '') === 'not_required') {
                continue;
            }
            $type = $doc['id'] ?? null;
            if (! $type) {
                continue;
            }
            $latest = DocumentSubmission::query()
                ->where('case_file_id', $caseFile->id)
                ->where('document_type', $type)
                ->orderByDesc('id')
                ->first();
            if (! $latest || DocumentWorkflowStatus::canonicalize($latest->status) !== DocumentWorkflowStatus::VERIFIED) {
                $unverified[] = $doc['label'] ?? $type;
            }
        }
        if ($unverified !== []) {
            $highlights[] = [
                'code' => 'documents_unverified',
                'severity' => 'warning',
                'message' => 'Required documents are not all verified: '.implode(', ', array_slice($unverified, 0, 6)),
                'fields' => $unverified,
            ];
        }

        $openForms = IrccInteractiveFormResponse::query()
            ->where('case_file_id', $caseFile->id)
            ->where(function ($q) {
                $q->whereNull('submitted_at')->orWhereNull('reviewed_at');
            })
            ->count();
        if ($openForms > 0) {
            $highlights[] = [
                'code' => 'forms_incomplete',
                'severity' => 'info',
                'message' => $openForms.' interactive form(s) are not submitted or not consultant-reviewed.',
                'fields' => ['interactive_forms'],
            ];
        }

        return $highlights;
    }

    private function normalize(string $value): string
    {
        return preg_replace('/\s+/', ' ', strtolower(trim($value))) ?? '';
    }

    private function dateOrNull(mixed $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }
        $ts = strtotime($value);

        return $ts ? date('Y-m-d', $ts) : null;
    }
}

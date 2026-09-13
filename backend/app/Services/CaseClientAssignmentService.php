<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\CaseRequirementPlan;
use App\Models\DocumentSubmission;
use App\Models\User;
use App\Support\CaseWorkflowStatus;

class CaseClientAssignmentService
{
    public function __construct(
        private CaseRequirementPlanService $plans,
        private CaseHistoryRecorder $history,
    ) {}

    /**
     * Client/consultant view of extra data, forms, and documents generated on pathway confirm.
     *
     * @return array<string, mixed>
     */
    public function serialize(CaseFile $caseFile, bool $forClient = false): array
    {
        $plan = $this->plans->currentPlan($caseFile);
        $snapshot = $plan?->snapshot ?? [];
        $agreementSigned = $caseFile->isAgreementSigned();
        $pathwaySelected = filled($caseFile->immigration_pathway);
        $hasPlan = $plan !== null;

        $extraFields = $snapshot['extra_fields'] ?? [];
        $askFields = [];
        $reusedFields = [];
        foreach ($extraFields as $field) {
            $status = $field['status'] ?? 'pending';
            if (in_array($status, ['reused', 'complete'], true) && $this->filled($field['value'] ?? null)) {
                $reusedFields[] = $field;
                continue;
            }
            if (($field['requirement_state'] ?? null) === 'not_required' || $status === 'obsolete') {
                continue;
            }
            $askFields[] = $field;
        }

        $documents = $this->serializeDocuments($caseFile, $snapshot['documents'] ?? []);
        $forms = $snapshot['forms'] ?? [];

        $extraUnlocked = $pathwaySelected && $hasPlan;
        $formsUnlocked = $agreementSigned && $hasPlan;
        $documentsUnlocked = $agreementSigned && $hasPlan;

        return [
            'pathway' => $plan?->pathway_label ?? $caseFile->immigration_pathway,
            'pathway_code' => $plan?->pathway_code ?? $caseFile->pathway_code,
            'registry_key' => $plan?->registry_key,
            'plan_version' => $plan?->plan_version,
            'facts' => $snapshot['facts'] ?? [],
            'extra_fields' => [
                'ask' => $askFields,
                'reused' => $reusedFields,
                'all' => $forClient ? $askFields : $extraFields,
            ],
            'forms' => $forms,
            'documents' => $documents,
            'representative' => $snapshot['representative'] ?? null,
            'tracks' => [
                'extra_data' => [
                    'unlocked' => $extraUnlocked,
                    'parallel' => $agreementSigned,
                ],
                'forms' => [
                    'unlocked' => $formsUnlocked,
                    'parallel' => $agreementSigned,
                ],
                'documents' => [
                    'unlocked' => $documentsUnlocked,
                    'parallel' => $agreementSigned,
                ],
            ],
            'parallel_after_activation' => $agreementSigned,
            'workflow' => CaseWorkflowStatus::serialize($caseFile->workflow_status, $caseFile->status),
        ];
    }

    /**
     * Persist extra-field answers on the current plan. Never deletes prior values.
     *
     * @param  array<string, mixed>  $answers  key => value|null
     */
    public function saveExtraData(CaseFile $caseFile, User $actor, array $answers, bool $allowNa = false): CaseRequirementPlan
    {
        $plan = $this->plans->currentPlan($caseFile);
        if (! $plan) {
            throw new \RuntimeException('Confirm a pathway before collecting additional pathway details.');
        }

        $snapshot = $plan->snapshot ?? [];
        $fields = $snapshot['extra_fields'] ?? [];
        $updated = [];

        foreach ($fields as $i => $field) {
            $key = (string) ($field['key'] ?? '');
            if ($key === '' || ! array_key_exists($key, $answers)) {
                continue;
            }

            $raw = $answers[$key];
            $alreadyKnown = in_array($field['status'] ?? 'pending', ['reused', 'complete'], true)
                && $this->filled($field['value'] ?? null);
            if (! $allowNa && $alreadyKnown) {
                continue;
            }

            if ($allowNa && $raw === '__na__') {
                $fields[$i]['status'] = 'not_required';
                $fields[$i]['requirement_state'] = 'not_required';
                $fields[$i]['answered_at'] = now()->toIso8601String();
                $fields[$i]['answered_by'] = $actor->id;
                $updated[] = $key;
                continue;
            }

            $value = is_string($raw) ? trim($raw) : $raw;
            if (! $this->filled($value)) {
                continue;
            }

            $fields[$i]['value'] = $value;
            $fields[$i]['status'] = 'complete';
            $fields[$i]['source'] = $fields[$i]['source'] ?? 'additional';
            $fields[$i]['answered_at'] = now()->toIso8601String();
            $fields[$i]['answered_by'] = $actor->id;
            $updated[] = $key;
        }

        $snapshot['extra_fields'] = $fields;
        $plan->update(['snapshot' => $snapshot]);

        if ($updated !== []) {
            $caseFile->loadMissing('clientProfile');
            $this->history->record(
                $caseFile->fresh(),
                'extra_data_saved',
                'Pathway-specific additional information saved',
                null,
                $actor,
                [
                    'keys' => $updated,
                    'plan_version' => $plan->plan_version,
                    'actor_role' => $actor->id === $caseFile->clientProfile?->user_id ? 'client' : 'consultant',
                ],
            );
        }

        return $plan->fresh();
    }

    /**
     * @param  list<array<string, mixed>>  $documents
     * @return list<array<string, mixed>>
     */
    private function serializeDocuments(CaseFile $caseFile, array $documents): array
    {
        $submissions = DocumentSubmission::query()
            ->where('case_file_id', $caseFile->id)
            ->orderByDesc('id')
            ->get()
            ->groupBy('document_type');

        $out = [];
        foreach ($documents as $doc) {
            $status = $doc['status'] ?? 'requested';
            if ($status === 'obsolete' || ($doc['requirement_state'] ?? null) === 'not_required') {
                continue;
            }

            $submission = $submissions->get($doc['id'] ?? '')?->first();
            if ($submission) {
                $doc['submission'] = [
                    'id' => $submission->id,
                    'status' => $submission->status,
                    'original_filename' => $submission->original_filename,
                    'uploaded_at' => $submission->created_at?->toIso8601String(),
                ];
                if (in_array($submission->status, ['consultant_approved', 'ai_verified'], true)) {
                    $doc['status'] = 'verified';
                } elseif ($submission->status === 'consultant_rejected') {
                    $doc['status'] = 'correction_required';
                } else {
                    $doc['status'] = 'uploaded';
                }
            }

            $out[] = $doc;
        }

        return $out;
    }

    private function filled(mixed $value): bool
    {
        if (is_array($value)) {
            return $value !== [];
        }

        return trim((string) $value) !== '';
    }
}

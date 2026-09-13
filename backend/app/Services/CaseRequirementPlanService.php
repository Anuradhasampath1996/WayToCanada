<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\CaseRequirementPlan;
use App\Models\PathwayRequirementDefinition;
use App\Models\User;
use App\Support\CaseWorkflowStatus;
use App\Support\PathwayRequirementCatalog;
use App\Support\RequirementPlanDiff;
use Illuminate\Support\Facades\DB;

class CaseRequirementPlanService
{
    public function __construct(
        private PathwayCatalogService $pathwayCatalog,
        private CaseHistoryRecorder $history,
        private CaseProfileFactsResolver $factsResolver,
    ) {}

    public function currentPlan(CaseFile $caseFile): ?CaseRequirementPlan
    {
        if ($caseFile->current_requirement_plan_id) {
            return CaseRequirementPlan::query()->find($caseFile->current_requirement_plan_id);
        }

        return CaseRequirementPlan::query()
            ->where('case_file_id', $caseFile->id)
            ->where('status', CaseRequirementPlan::STATUS_CURRENT)
            ->orderByDesc('plan_version')
            ->first();
    }

    /**
     * Build a proposed snapshot from the effective published registry (does not persist).
     *
     * @return array{definition: ?PathwayRequirementDefinition, snapshot: array<string, mixed>, registry_key: string}
     */
    public function preview(CaseFile $caseFile, ?string $pathwayCode = null, ?string $pathwayLabel = null, array $facts = []): array
    {
        $code = $pathwayCode ?? $caseFile->pathway_code;
        $label = $pathwayLabel ?? $caseFile->immigration_pathway;
        $family = $this->resolveFamily($caseFile, $code, $label);
        $key = PathwayRequirementCatalog::resolveKey($code, $family, $label);
        $definition = $this->effectiveDefinition($key);
        $facts = $facts === [] ? $this->factsResolver->facts($caseFile) : $facts;

        $snapshot = $this->buildSnapshotFromDefinition(
            $caseFile,
            $definition?->definition ?? PathwayRequirementCatalog::definitions()[$key] ?? PathwayRequirementCatalog::definitions()['default'],
            $facts
        );
        $snapshot['registry_key'] = $key;
        $snapshot['registry_version'] = $definition?->version ?? PathwayRequirementCatalog::VERSION;
        $snapshot['pathway_code'] = $code;
        $snapshot['pathway_label'] = $label;
        $snapshot['family'] = $family;
        $snapshot['source'] = [
            'name' => $definition?->source_name ?? PathwayRequirementCatalog::SOURCE_NAME,
            'reference' => $definition?->source_reference ?? PathwayRequirementCatalog::SOURCE_REFERENCE,
            'last_verified_at' => $definition?->last_verified_at?->toIso8601String(),
            'effective_from' => $definition?->effective_from?->toIso8601String(),
            'effective_to' => $definition?->effective_to?->toIso8601String(),
        ];

        return [
            'definition' => $definition,
            'snapshot' => $snapshot,
            'registry_key' => $key,
        ];
    }

    /**
     * Persist a versioned plan. Previous plan is superseded, never deleted.
     */
    public function snapshotForPathway(
        CaseFile $caseFile,
        ?User $actor,
        string $reason,
        ?string $pathwayCode = null,
        ?string $pathwayLabel = null,
        ?string $changeNote = null,
        array $facts = [],
    ): CaseRequirementPlan {
        return DB::connection('cws')->transaction(function () use ($caseFile, $actor, $reason, $pathwayCode, $pathwayLabel, $changeNote, $facts) {
            $caseFile = $caseFile->fresh();
            $previous = $this->latestPlan($caseFile);
            $preview = $this->preview($caseFile, $pathwayCode, $pathwayLabel, $facts);
            $snapshot = $preview['snapshot'];

            if ($previous) {
                $snapshot = RequirementPlanDiff::mergePreservingHistory($previous->snapshot ?? [], $snapshot);
                if ($previous->status === CaseRequirementPlan::STATUS_CURRENT) {
                    $previous->update(['status' => CaseRequirementPlan::STATUS_SUPERSEDED]);
                }
            }

            $nextVersion = (int) CaseRequirementPlan::query()
                ->where('case_file_id', $caseFile->id)
                ->max('plan_version') + 1;

            $plan = CaseRequirementPlan::create([
                'case_file_id' => $caseFile->id,
                'pathway_requirement_definition_id' => $preview['definition']?->id,
                'plan_version' => $nextVersion,
                'registry_version' => $snapshot['registry_version'] ?? null,
                'registry_key' => $preview['registry_key'],
                'pathway_code' => $pathwayCode ?? $caseFile->pathway_code,
                'pathway_label' => $pathwayLabel ?? $caseFile->immigration_pathway,
                'status' => CaseRequirementPlan::STATUS_CURRENT,
                'snapshot' => $snapshot,
                'previous_plan_id' => $previous?->id,
                'created_by' => $actor?->id,
                'change_reason' => $reason,
                'change_note' => $changeNote,
            ]);

            $caseFile->update([
                'current_requirement_plan_id' => $plan->id,
                'workflow_status' => $this->nextWorkflowStatus($caseFile),
            ]);

            $this->history->record(
                $caseFile->fresh(),
                $reason === 'pathway_change' ? 'pathway_changed' : 'requirement_plan_snapshotted',
                $reason === 'pathway_change' ? 'Pathway changed and requirement plan regenerated' : 'Requirement plan snapshotted',
                $changeNote,
                $actor,
                [
                    'old_pathway' => $previous?->pathway_label,
                    'new_pathway' => $plan->pathway_label,
                    'old_pathway_code' => $previous?->pathway_code,
                    'new_pathway_code' => $plan->pathway_code,
                    'old_plan_version' => $previous?->plan_version,
                    'new_plan_version' => $plan->plan_version,
                    'registry_key' => $plan->registry_key,
                    'registry_version' => $plan->registry_version,
                    'consultant_id' => $actor?->id,
                    'reason' => $reason,
                    'diff' => $previous ? RequirementPlanDiff::compare($previous->snapshot ?? [], $snapshot) : null,
                ],
            );

            return $plan;
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function registryDiff(CaseFile $caseFile): array
    {
        $current = $this->currentPlan($caseFile);
        if (! $current) {
            return ['has_update' => false, 'diff' => null];
        }

        $preview = $this->preview($caseFile, $current->pathway_code, $current->pathway_label, $this->factsResolver->facts($caseFile));
        $latestVersion = $preview['definition']?->version;
        $hasUpdate = $latestVersion !== null && (int) $latestVersion !== (int) $current->registry_version;

        return [
            'has_update' => $hasUpdate,
            'current_registry_version' => $current->registry_version,
            'latest_registry_version' => $latestVersion,
            'diff' => RequirementPlanDiff::compare($current->snapshot ?? [], $preview['snapshot']),
            'proposed_snapshot' => $preview['snapshot'],
        ];
    }

    public function applyRegistryUpdate(CaseFile $caseFile, User $actor, ?string $note = null): CaseRequirementPlan
    {
        $diff = $this->registryDiff($caseFile);
        if (! ($diff['has_update'] ?? false)) {
            throw new \RuntimeException('No newer registry version is available for this case.');
        }

        $current = $this->currentPlan($caseFile);
        if (! $current) {
            throw new \RuntimeException('No current requirement plan to update.');
        }

        return $this->snapshotForPathway(
            $caseFile,
            $actor,
            'registry_update',
            $current->pathway_code,
            $current->pathway_label,
            $note,
        );
    }

    /**
     * Clear the active pointer only. Previous plans and collected items stay in history.
     */
    public function releaseCurrentPlan(CaseFile $caseFile, ?User $actor, ?string $note = null): void
    {
        DB::connection('cws')->transaction(function () use ($caseFile, $actor, $note) {
            $current = $this->currentPlan($caseFile);
            if ($current && $current->status === CaseRequirementPlan::STATUS_CURRENT) {
                $current->update(['status' => CaseRequirementPlan::STATUS_SUPERSEDED]);
            }

            $caseFile->update([
                'current_requirement_plan_id' => null,
            ]);

            $this->history->record(
                $caseFile->fresh(),
                'pathway_cleared',
                'Pathway selection cleared',
                $note,
                $actor,
                [
                    'old_pathway' => $current?->pathway_label,
                    'new_pathway' => null,
                    'old_pathway_code' => $current?->pathway_code,
                    'new_pathway_code' => null,
                    'old_plan_version' => $current?->plan_version,
                    'new_plan_version' => null,
                    'consultant_id' => $actor?->id,
                    'reason' => 'clear',
                ],
            );
        });
    }

    public function confirmSubmissionPortal(CaseFile $caseFile, User $actor, string $portal, ?string $note = null): CaseRequirementPlan
    {
        $plan = $this->currentPlan($caseFile);
        if (! $plan) {
            throw new \RuntimeException('Confirm a pathway before selecting a submission portal.');
        }

        $snapshot = $plan->snapshot ?? [];
        $snapshot['portals'] = $snapshot['portals'] ?? [];
        $snapshot['portals']['confirmed'] = $portal;
        $snapshot['portals']['confirmed_at'] = now()->toIso8601String();
        $snapshot['portals']['confirmed_by'] = $actor->id;

        $plan->update(['snapshot' => $snapshot]);
        $caseFile->update(['confirmed_submission_portal' => $portal]);

        $this->history->record(
            $caseFile->fresh(),
            'submission_portal_confirmed',
            'Submission portal confirmed',
            $note,
            $actor,
            [
                'portal' => $portal,
                'recommended' => $snapshot['portals']['recommended'] ?? [],
                'plan_version' => $plan->plan_version,
                'auto_submitted' => false,
            ],
        );

        return $plan->fresh();
    }

    public function serializePlan(?CaseRequirementPlan $plan): ?array
    {
        if (! $plan) {
            return null;
        }

        return [
            'id' => $plan->id,
            'plan_version' => $plan->plan_version,
            'registry_key' => $plan->registry_key,
            'registry_version' => $plan->registry_version,
            'pathway_code' => $plan->pathway_code,
            'pathway_label' => $plan->pathway_label,
            'status' => $plan->status,
            'change_reason' => $plan->change_reason,
            'snapshot' => $plan->snapshot,
            'previous_plan_id' => $plan->previous_plan_id,
            'created_at' => $plan->created_at?->toIso8601String(),
        ];
    }

    private function resolveFamily(CaseFile $caseFile, ?string $code, ?string $label): ?string
    {
        if ($code) {
            $node = $this->pathwayCatalog->findByCode($code);
            if ($node && method_exists($node, 'hubFamilyLabel')) {
                return $node->hubFamilyLabel();
            }
        }

        return \App\Services\CaseManagementHubService::pathwayFamily($label ?? $caseFile->immigration_pathway);
    }

    private function effectiveDefinition(string $key): ?PathwayRequirementDefinition
    {
        return PathwayRequirementDefinition::query()
            ->where('registry_key', $key)
            ->where('is_published', true)
            ->where(function ($q) {
                $q->whereNull('effective_from')->orWhere('effective_from', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('effective_to')->orWhere('effective_to', '>=', now());
            })
            ->orderByDesc('version')
            ->first();
    }

    /**
     * @param  array<string, mixed>  $definition
     * @param  array<string, mixed>  $facts
     * @return array<string, mixed>
     */
    private function buildSnapshotFromDefinition(CaseFile $caseFile, array $definition, array $facts): array
    {
        $represented = array_key_exists('represented_by_consultant', $facts)
            ? (bool) $facts['represented_by_consultant']
            : true;
        $selfSubmit = (bool) ($facts['client_self_submit'] ?? false);

        $repDefault = $definition['representative']['default'] ?? 'optional';
        $repStatus = $repDefault;
        if ($selfSubmit || ! $represented) {
            $repStatus = 'not_applicable';
        }

        $forms = [];
        $seenFormCodes = [];
        foreach ($definition['official_form_codes'] ?? [] as $code) {
            $forms[] = [
                'code' => $code,
                'name' => $code,
                'kind' => 'official',
                'status' => 'pending',
            ];
            $seenFormCodes[$code] = true;
        }

        $repCode = $definition['representative']['form_code'] ?? 'IMM5476';
        if ($repStatus !== 'not_applicable' && ! isset($seenFormCodes[$repCode])) {
            $forms[] = [
                'code' => $repCode,
                'name' => 'Use of a Representative',
                'kind' => 'representative',
                'status' => 'pending',
                'requirement_state' => $repStatus,
            ];
            $seenFormCodes[$repCode] = true;
        }

        foreach ($definition['interactive_form_slugs'] ?? [] as $slug) {
            if (isset($seenFormCodes[$slug])) {
                continue;
            }
            $forms[] = [
                'code' => $slug,
                'name' => $slug,
                'kind' => 'interactive',
                'status' => 'pending',
            ];
            $seenFormCodes[$slug] = true;
        }

        $caseFile->loadMissing(['assignedIrccCategory.interactiveForms']);
        foreach ($caseFile->assignedIrccCategory?->interactiveForms ?? [] as $form) {
            if (! $form->is_active) {
                continue;
            }
            $code = $form->slug ?: 'interactive-'.$form->id;
            if (isset($seenFormCodes[$code])) {
                continue;
            }
            $forms[] = [
                'code' => $code,
                'name' => $form->title ?? $code,
                'kind' => 'interactive',
                'form_id' => $form->id,
                'status' => 'pending',
            ];
            $seenFormCodes[$code] = true;
        }

        $documents = [];
        foreach ($definition['documents'] ?? [] as $doc) {
            $requiredIf = $doc['required_if'] ?? [];
            $applicable = $this->conditionsMatch($requiredIf, $facts);
            $reuseFrom = $doc['reuse_from'] ?? [];
            $candidate = $applicable ? $this->factsResolver->documentCandidate($caseFile, $reuseFrom) : null;
            $documents[] = [
                'id' => $doc['id'],
                'label' => $doc['label'],
                'category' => $doc['category'] ?? 'other',
                'required_if' => $requiredIf,
                'reuse_from' => $reuseFrom,
                'reuse_candidate' => $candidate,
                'status' => $applicable ? 'requested' : 'not_required',
                'requirement_state' => $applicable ? 'required' : 'not_required',
            ];
        }

        return [
            'calculators' => $definition['calculators'] ?? [],
            'facts' => $facts,
            'extra_fields' => array_map(function (array $field) use ($caseFile) {
                $reuseFrom = $field['reuse_from'] ?? [];
                $value = $this->factsResolver->fieldValue($caseFile, $reuseFrom);
                $reused = $value !== null && $value !== '';

                return [
                    'key' => $field['key'],
                    'label' => $field['label'],
                    'reuse_from' => $reuseFrom,
                    'value' => $reused ? $value : null,
                    'status' => $reused ? 'reused' : 'pending',
                    'source' => $reused ? 'intake' : null,
                ];
            }, $definition['extra_fields'] ?? []),
            'forms' => $forms,
            'documents' => $documents,
            'representative' => [
                'status' => $repStatus,
                'form_code' => $definition['representative']['form_code'] ?? 'IMM5476',
                'bypass_allowed' => $repStatus !== 'required',
            ],
            'portals' => [
                'recommended' => $definition['submission_portals'] ?? ['ircc_rep'],
                'confirmed' => null,
            ],
            'client_acknowledgement_required' => (bool) ($definition['client_acknowledgement_required'] ?? true),
            'client_signature_required' => (bool) ($definition['client_signature_required'] ?? false),
            'obsolete_items' => [],
        ];
    }

    /**
     * @param  list<string>  $requiredIf
     * @param  array<string, mixed>  $facts
     */
    private function conditionsMatch(array $requiredIf, array $facts): bool
    {
        if ($requiredIf === []) {
            return true;
        }

        foreach ($requiredIf as $flag) {
            if (! empty($facts[$flag])) {
                return true;
            }
        }

        return false;
    }

    private function latestPlan(CaseFile $caseFile): ?CaseRequirementPlan
    {
        return $this->currentPlan($caseFile)
            ?? CaseRequirementPlan::query()
                ->where('case_file_id', $caseFile->id)
                ->orderByDesc('plan_version')
                ->first();
    }

    private function nextWorkflowStatus(CaseFile $caseFile): string
    {
        $current = CaseWorkflowStatus::resolveForCase($caseFile->workflow_status, $caseFile->status);
        $order = CaseWorkflowStatus::ORDER[$current] ?? 0;
        $signed = $caseFile->statusStep() >= CaseFile::statusOrder()['AGREEMENT_SIGNED'];

        if ($signed) {
            return $order >= CaseWorkflowStatus::ORDER[CaseWorkflowStatus::CASE_ACTIVE]
                ? $current
                : CaseWorkflowStatus::CASE_ACTIVE;
        }

        return $order >= CaseWorkflowStatus::ORDER[CaseWorkflowStatus::PATHWAY_SELECTED]
            ? $current
            : CaseWorkflowStatus::PATHWAY_SELECTED;
    }
}

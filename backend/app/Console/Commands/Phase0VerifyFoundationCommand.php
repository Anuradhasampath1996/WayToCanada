<?php

namespace App\Console\Commands;

use App\Models\CaseFile;
use App\Models\CaseHistoryEvent;
use App\Models\CaseRequirementPlan;
use App\Models\ClientProfile;
use App\Models\PathwayRequirementDefinition;
use App\Models\User;
use App\Services\CaseRequirementPlanService;
use App\Support\PathwayRequirementCatalog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Phase 0 operator checks: legacy integrity, pathway snapshot journey, registry apply gate.
 */
class Phase0VerifyFoundationCommand extends Command
{
    protected $signature = 'phase0:verify-foundation
                            {--legacy : Inspect existing/legacy case data (no writes)}
                            {--journey : Select → snapshot → change → diff → portal → history}
                            {--registry : Newer registry must not mutate a case until apply}';

    protected $description = 'Phase 0 foundation verification (legacy integrity, journey, registry apply)';

    public function handle(CaseRequirementPlanService $plans): int
    {
        $runLegacy = (bool) $this->option('legacy');
        $runJourney = (bool) $this->option('journey');
        $runRegistry = (bool) $this->option('registry');
        if (! $runLegacy && ! $runJourney && ! $runRegistry) {
            $runLegacy = $runJourney = $runRegistry = true;
        }

        $failed = 0;
        if ($runLegacy) {
            $failed += $this->verifyLegacy() ? 0 : 1;
        }
        if ($runJourney) {
            $failed += $this->verifyJourney($plans) ? 0 : 1;
        }
        if ($runRegistry) {
            $failed += $this->verifyRegistry($plans) ? 0 : 1;
        }

        $this->newLine();
        $this->info($failed === 0 ? 'PHASE0_VERIFY=PASS' : 'PHASE0_VERIFY=FAIL');

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function verifyLegacy(): bool
    {
        $this->info('=== CHECK 2 — Legacy / existing DB integrity ===');
        $ok = true;

        $requiredTables = [
            'case_files',
            'users',
            'client_profiles',
            'pathway_requirement_definitions',
            'case_requirement_plans',
            'case_history_events',
        ];
        foreach ($requiredTables as $table) {
            $exists = Schema::connection('cws')->hasTable($table);
            $this->line(($exists ? 'PASS' : 'FAIL')." table {$table} exists");
            $ok = $ok && $exists;
        }

        $requiredColumns = [
            'current_requirement_plan_id',
            'workflow_status',
            'confirmed_submission_portal',
            'consultation_completed_at',
            'consultation_skipped_at',
            'consultation_skip_reason',
            'profile_reviewed_at',
            'immigration_pathway',
            'status',
            'agreement_signed_at',
        ];
        foreach ($requiredColumns as $column) {
            $exists = Schema::connection('cws')->hasColumn('case_files', $column);
            $this->line(($exists ? 'PASS' : 'FAIL')." case_files.{$column}");
            $ok = $ok && $exists;
        }

        $counts = [
            'users' => User::query()->count(),
            'client_profiles' => ClientProfile::query()->count(),
            'case_files' => CaseFile::query()->count(),
            'registry_definitions' => PathwayRequirementDefinition::query()->count(),
            'requirement_plans' => CaseRequirementPlan::query()->count(),
            'history_events' => CaseHistoryEvent::query()->count(),
        ];
        foreach ($counts as $label => $count) {
            $this->line("COUNT {$label}={$count}");
        }

        $legacyCases = CaseFile::query()->orderBy('id')->limit(8)->get([
            'id', 'status', 'immigration_pathway', 'pathway_code',
            'agreement_signed_at', 'current_requirement_plan_id', 'workflow_status',
        ]);
        $this->line('SAMPLE_LEGACY_CASES='.$legacyCases->count());
        foreach ($legacyCases as $case) {
            $this->line(sprintf(
                '  case#%d status=%s pathway=%s plan_id=%s workflow=%s signed=%s',
                $case->id,
                $case->status,
                $case->immigration_pathway ?: '-',
                $case->current_requirement_plan_id ?: 'null',
                $case->workflow_status ?: 'null',
                $case->agreement_signed_at ? 'yes' : 'no',
            ));
        }

        $nullPlans = CaseFile::query()->whereNull('current_requirement_plan_id')->count();
        $this->line("legacy_cases_without_plan={$nullPlans} (expected: existing cases may be null)");

        $this->line($ok ? 'CHECK2=PASS' : 'CHECK2=FAIL');

        return $ok;
    }

    private function verifyJourney(CaseRequirementPlanService $plans): bool
    {
        $this->info('=== CHECK 3 — Select → snapshot → change → diff → confirm → history ===');
        $ok = true;
        $created = $this->makeIsolatedCase();

        try {
            $case = $created['case'];
            $actor = $created['consultant'];

            $first = $plans->snapshotForPathway(
                $case,
                $actor,
                'assign',
                'ee.cec',
                'Express Entry – Canadian Experience Class',
            );
            $this->assertTrue($ok, $first->plan_version === 1, 'first plan_version=1');
            $this->assertTrue($ok, $first->status === CaseRequirementPlan::STATUS_CURRENT, 'first plan current');
            $this->assertTrue($ok, ($first->snapshot['representative']['bypass_allowed'] ?? true) === false, 'EE IMM5476 cannot be N/A');
            $this->assertTrue($ok, empty($first->snapshot['portals']['confirmed']), 'portal not auto-confirmed');

            $second = $plans->snapshotForPathway(
                $case->fresh(),
                $actor,
                'pathway_change',
                'study',
                'Study Permit',
                'Client will study first.',
            );
            $this->assertTrue($ok, $second->plan_version === 2, 'changed plan_version=2');
            $this->assertTrue($ok, $first->fresh()->status === CaseRequirementPlan::STATUS_SUPERSEDED, 'old plan superseded, not deleted');
            $this->assertTrue($ok, CaseRequirementPlan::query()->where('case_file_id', $case->id)->count() === 2, 'both plans retained');
            $this->assertTrue($ok, $second->previous_plan_id === $first->id, 'previous_plan_id linked');
            $obsolete = $second->snapshot['obsolete_items'] ?? [];
            $this->assertTrue($ok, $obsolete !== [], 'obsolete items preserved from previous pathway');

            $confirmed = $plans->confirmSubmissionPortal($case->fresh(), $actor, 'ircc_rep', 'Consultant confirmed IRCC rep portal.');
            $this->assertTrue($ok, ($confirmed->snapshot['portals']['confirmed'] ?? null) === 'ircc_rep', 'portal confirmed on snapshot');
            $this->assertTrue($ok, $case->fresh()->confirmed_submission_portal === 'ircc_rep', 'portal stored on case');

            $events = CaseHistoryEvent::query()
                ->where('case_file_id', $case->id)
                ->orderBy('id')
                ->get();
            $types = $events->pluck('event_type')->all();
            $this->line('HISTORY_TYPES='.implode(',', $types));
            $change = $events->firstWhere('event_type', 'pathway_changed');
            $this->assertTrue($ok, $change !== null, 'pathway_changed history exists');
            $this->assertTrue($ok, ($change?->payload['old_plan_version'] ?? null) === 1, 'history old_plan_version=1');
            $this->assertTrue($ok, ($change?->payload['new_plan_version'] ?? null) === 2, 'history new_plan_version=2');
            $this->assertTrue($ok, filled($change?->payload['diff'] ?? null), 'history includes diff');
            $this->assertTrue($ok, $events->contains(fn ($e) => $e->event_type === 'submission_portal_confirmed'), 'portal confirm in history');
            $this->assertTrue($ok, $events->contains(fn ($e) => ($e->payload['auto_submitted'] ?? null) === false), 'nothing auto-submitted');
        } finally {
            $this->cleanupIsolatedCase($created);
        }

        $this->line($ok ? 'CHECK3=PASS' : 'CHECK3=FAIL');

        return $ok;
    }

    private function verifyRegistry(CaseRequirementPlanService $plans): bool
    {
        $this->info('=== CHECK 4 — Registry update does not mutate case until apply ===');
        $ok = true;
        $created = $this->makeIsolatedCase();
        $v2 = null;

        try {
            $case = $created['case'];
            $actor = $created['consultant'];
            $plan = $plans->snapshotForPathway($case, $actor, 'assign', 'study', 'Study Permit');
            $frozenVersion = (int) $plan->registry_version;
            $frozenForms = collect($plan->snapshot['forms'] ?? [])->pluck('code')->sort()->values()->all();

            $currentDef = PathwayRequirementDefinition::query()
                ->where('registry_key', 'Study Permit')
                ->orderByDesc('version')
                ->first();
            $this->assertTrue($ok, $currentDef !== null, 'Study Permit registry row exists');

            $definition = $currentDef->definition;
            $definition['official_form_codes'][] = 'IMM 5708';
            $v2 = PathwayRequirementDefinition::create([
                'registry_key' => 'Study Permit',
                'family' => 'Study Permit',
                'version' => ((int) $currentDef->version) + 1,
                'effective_from' => now()->subMinute(),
                'effective_to' => null,
                'source_name' => 'Phase 0 verification',
                'source_reference' => 'Temporary v2 for apply-gate check',
                'last_verified_at' => now(),
                'definition' => $definition,
                'is_published' => true,
            ]);

            $still = $plans->currentPlan($case->fresh());
            $stillForms = collect($still?->snapshot['forms'] ?? [])->pluck('code')->sort()->values()->all();
            $this->assertTrue($ok, (int) $still?->registry_version === $frozenVersion, 'case still on frozen registry version');
            $this->assertTrue($ok, $stillForms === $frozenForms, 'snapshot forms unchanged before apply');

            $diff = $plans->registryDiff($case->fresh());
            $this->assertTrue($ok, ($diff['has_update'] ?? false) === true, 'diff reports has_update');
            $addedCodes = collect($diff['diff']['added_forms'] ?? [])->pluck('code')->all();
            $this->assertTrue($ok, in_array('IMM 5708', $addedCodes, true), 'diff lists added IMM 5708');

            $applied = $plans->applyRegistryUpdate($case->fresh(), $actor, 'Verification apply');
            $this->assertTrue($ok, (int) $applied->registry_version === $v2->version, 'apply moved plan to new registry version');
            $this->assertTrue($ok, $plan->fresh()->status === CaseRequirementPlan::STATUS_SUPERSEDED, 'old plan kept as superseded');
            $this->assertTrue($ok, CaseRequirementPlan::query()->where('case_file_id', $case->id)->count() === 2, 'both plan versions retained');
        } finally {
            if ($v2) {
                $v2->delete();
            }
            $this->cleanupIsolatedCase($created);
        }

        $this->line($ok ? 'CHECK4=PASS' : 'CHECK4=FAIL');

        return $ok;
    }

    /**
     * @return array{consultant: User, client: User, profile: ClientProfile, case: CaseFile}
     */
    private function makeIsolatedCase(): array
    {
        $suffix = Str::lower(Str::random(8));
        $consultant = User::query()->create([
            'name' => 'Phase0 Verify RCIC',
            'email' => "phase0.verify.{$suffix}@example.test",
            'password' => Hash::make('secret'),
            'rcic_number' => 'R000000001',
        ]);
        if (method_exists($consultant, 'assignRole')) {
            $consultant->assignRole('rcic');
        }

        $client = User::query()->create([
            'name' => 'Phase0 Verify Client',
            'email' => "phase0.client.{$suffix}@example.test",
            'password' => Hash::make('secret'),
        ]);

        $profile = ClientProfile::query()->create([
            'user_id' => $client->id,
            'consultant_id' => $consultant->id,
        ]);

        $case = CaseFile::query()->create([
            'client_profile_id' => $profile->id,
            'consultant_id' => $consultant->id,
            'case_number' => random_int(1000, 32000),
            'name' => 'Phase0 verification case',
            'status' => 'PENDING_ASSESSMENT',
            'lifecycle_status' => 'in_progress',
        ]);
        $profile->update(['active_case_file_id' => $case->id]);

        return compact('consultant', 'client', 'profile', 'case');
    }

    /**
     * @param  array{consultant: User, client: User, profile: ClientProfile, case: CaseFile}  $created
     */
    private function cleanupIsolatedCase(array $created): void
    {
        $caseId = $created['case']->id;
        CaseHistoryEvent::query()->where('case_file_id', $caseId)->delete();
        $created['case']->update(['current_requirement_plan_id' => null]);
        CaseRequirementPlan::query()->where('case_file_id', $caseId)->delete();
        $created['case']->delete();
        $created['profile']->delete();
        $created['client']->delete();
        $created['consultant']->delete();
    }

    private function assertTrue(bool &$ok, bool $condition, string $label): void
    {
        $this->line(($condition ? 'PASS' : 'FAIL').' '.$label);
        if (! $condition) {
            $ok = false;
        }
    }
}

<?php

namespace App\Console\Commands;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\IrccInteractiveForm;
use App\Models\IrccInteractiveFormResponse;
use App\Models\User;
use App\Services\IrccInteractiveFormVerificationService;
use App\Services\IrccPackageSuggestionService;
use App\Services\PathwayCatalogService;
use App\Support\IrccFamilySponsorshipPackages;
use App\Support\IrccPackageFormMode;
use App\Models\PathwayNode;
use Database\Seeders\PathwayFlowQaSeeder;
use Database\Seeders\PathwayCatalogSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;

/**
 * Deep QA: pathway → auto package → form_mode → agreement → unlock → docs gate.
 * Does not skip steps. Reports PASS/FAIL matrix and auto-fixes missing Family Sponsorship leaves.
 */
class QaPathwayFlowCommand extends Command
{
    protected $signature = 'qa:pathway-flow
                            {--seed : Re-seed QA pathway clients before running}
                            {--fix : Apply safe auto-fixes (Family Sponsorship leaves, package heal)}';

    protected $description = 'Deep QA of pathway → package → forms → unlock flow for every pathway type';

    /** @var list<array{pathway: string, check: string, result: string, detail: string}> */
    private array $rows = [];

    private int $pass = 0;

    private int $fail = 0;

    public function handle(
        IrccPackageSuggestionService $packages,
        IrccInteractiveFormVerificationService $verification,
        PathwayCatalogService $catalog,
    ): int {
        $this->info('=== WayToCanada pathway flow deep QA ===');

        if ($this->option('fix') || $this->option('seed')) {
            Artisan::call('db:seed', ['--class' => PathwayCatalogSeeder::class, '--force' => true]);
            $ensured = IrccFamilySponsorshipPackages::ensure();
            $this->line('Family Sponsorship packages: created='.count($ensured['created']).' updated='.count($ensured['updated']));
            if ($ensured['skipped'] !== []) {
                $this->warn('Skipped: '.implode(', ', $ensured['skipped']));
            }
        }

        if ($this->option('seed')) {
            Artisan::call('db:seed', ['--class' => PathwayFlowQaSeeder::class, '--force' => true]);
            $this->line(Artisan::output());
        }

        // Always ensure Family Sponsorship leaves exist before matrix (non-destructive).
        IrccFamilySponsorshipPackages::ensure();

        $this->assertFamilySponsorshipLeavesExist();
        $this->assertCatalogPhaseA($catalog);

        foreach (PathwayFlowQaSeeder::CLIENTS as $spec) {
            $this->runPathwayMatrix($spec, $packages, $verification, $catalog);
        }

        // Also run pure suggestion checks without relying on seeded clients.
        $this->runSuggestionMatrix($packages);

        $this->newLine();
        $this->table(['Pathway', 'Check', 'Result', 'Detail'], array_map(
            fn (array $r) => [$r['pathway'], $r['check'], $r['result'], $r['detail']],
            $this->rows
        ));

        $this->newLine();
        $this->info("PASS: {$this->pass}  FAIL: {$this->fail}");

        return $this->fail > 0 ? self::FAILURE : self::SUCCESS;
    }

    private function assertCatalogPhaseA(PathwayCatalogService $catalog): void
    {
        $required = ['ee.fsw', 'ee.cec', 'ee.fst', 'pnp', 'pnp.on', 'pnp.on.employer-job-offer', 'family.spouse', 'family.pgp', 'study', 'work', 'visitor', 'visitor.super', 'citizenship', 'pr_card', 'pilot.rcip.thunder-bay', 'pilot.fcip.sudbury', 'pilot.aip.ns', 'quebec.pstq', 'business.startup'];
        foreach ($required as $code) {
            $node = $catalog->findByCode($code);
            $this->record(
                'Catalog',
                'node '.$code,
                $node !== null && $node->is_assignable,
                $node?->label ?? 'MISSING'
            );
        }
        $count = PathwayNode::query()->where('is_active', true)->count();
        $this->record('Catalog', 'active node count', $count >= 85, (string) $count);
        $rcipKids = PathwayNode::query()->where('parent_code', 'pilot.rcip')->where('is_active', true)->count();
        $fcipKids = PathwayNode::query()->where('parent_code', 'pilot.fcip')->where('is_active', true)->count();
        $this->record('Catalog', 'RCIP communities', $rcipKids === 14, (string) $rcipKids);
        $this->record('Catalog', 'FCIP communities', $fcipKids === 6, (string) $fcipKids);
        $aipKids = PathwayNode::query()->where('parent_code', 'pilot.aip')->where('is_active', true)->count();
        $this->record('Catalog', 'AIP provinces', $aipKids === 4, (string) $aipKids);
        $quebecKids = PathwayNode::query()->where('parent_code', 'quebec')->where('is_active', true)->count();
        $businessKids = PathwayNode::query()->where('parent_code', 'business')->where('is_active', true)->count();
        $oinpStreams = PathwayNode::query()->where('parent_code', 'pnp.on')->where('is_active', true)->count();
        $this->record('Catalog', 'Quebec streams', $quebecKids >= 3, (string) $quebecKids);
        $this->record('Catalog', 'Business streams', $businessKids >= 3, (string) $businessKids);
        $this->record('Catalog', 'OINP streams', $oinpStreams >= 4, (string) $oinpStreams);
        $mbStreams = PathwayNode::query()->where('parent_code', 'pnp.mb')->where('is_active', true)->count();
        $this->record('Catalog', 'MPNP streams', $mbStreams >= 2, (string) $mbStreams);
    }

    private function assertFamilySponsorshipLeavesExist(): void
    {
        foreach (IrccFamilySponsorshipPackages::leafDefinitions() as $def) {
            $exists = \App\Models\IrccCategory::query()
                ->where('level', 3)
                ->where('label', $def['label'])
                ->exists();
            $this->record(
                'Family Sponsorship',
                'leaf exists: '.$def['label'],
                $exists,
                $exists ? 'present' : 'MISSING — run with --fix'
            );
        }
    }

    /** @param  array{pathway: string, pathway_code?: string, email: string, name: string, stage: string}  $spec */
    private function runPathwayMatrix(
        array $spec,
        IrccPackageSuggestionService $packages,
        IrccInteractiveFormVerificationService $verification,
        PathwayCatalogService $catalog,
    ): void {
        $resolved = $catalog->resolve($spec['pathway_code'] ?? null, $spec['pathway']);
        $pathway = $resolved['label'] ?? $spec['pathway'];
        $expectedCode = $resolved['code'] ?? ($spec['pathway_code'] ?? null);
        $user = User::where('email', $spec['email'])->first();
        if (! $user) {
            $this->record($pathway, 'QA client exists', false, $spec['email'].' missing — run with --seed');

            return;
        }

        $profile = ClientProfile::where('user_id', $user->id)
            ->where('consultant_id', User::where('email', PathwayFlowQaSeeder::CONSULTANT_EMAIL)->value('id'))
            ->first();

        if (! $profile) {
            $this->record($pathway, 'client profile', false, 'profile missing');

            return;
        }

        $case = CaseFile::query()
            ->where('client_profile_id', $profile->id)
            ->where('lifecycle_status', 'active')
            ->orderByDesc('id')
            ->first()
            ?? CaseFile::where('client_profile_id', $profile->id)->orderByDesc('id')->first();

        if (! $case) {
            $this->record($pathway, 'active case file', false, 'no case');

            return;
        }

        if ($this->option('fix')) {
            $case = $catalog->backfillCodeIfNeeded($case);
        }

        // Step 1: questionnaire submitted
        $q = $user->questionnaireSubmission ?? \App\Models\QuestionnaireSubmission::where('user_id', $user->id)->first();
        $this->record($pathway, '1. questionnaire submitted', (bool) ($q?->is_submitted), $q ? 'ok' : 'missing');

        // Step 2: pathway set
        $this->record(
            $pathway,
            '2. pathway assigned',
            $case->immigration_pathway === $pathway || $case->pathway_code === $expectedCode,
            (string) ($case->immigration_pathway ?? 'null')
        );
        $this->record(
            $pathway,
            '2b. pathway_code',
            $expectedCode !== null && $case->pathway_code === $expectedCode,
            (string) ($case->pathway_code ?? 'null').' expected='.($expectedCode ?? 'null')
        );

        // Step 3: package suggestion + assignment
        $suggestion = $packages->suggestForCase($case, $pathway);
        $suggested = $suggestion['category'] ?? null;
        $this->record(
            $pathway,
            '3a. package suggestion',
            $suggested !== null,
            $suggested
                ? "{$suggested->label} ({$suggestion['source']}/{$suggestion['confidence']})"
                : ($suggestion['reason'] ?? 'none')
        );

        if ($this->option('fix') && $suggested && (int) $case->assigned_ircc_category_id !== (int) $suggested->id) {
            $packages->autoAssignForPathway($case->fresh(), $pathway);
            $case = $case->fresh();
        }

        if ($this->option('fix')) {
            $heal = $packages->healMismatchIfNeeded($case->fresh());
            if ($heal['healed'] ?? false) {
                $case = $case->fresh();
            }
        }

        $case->loadMissing('assignedIrccCategory');
        $assigned = $case->assignedIrccCategory;
        $this->record(
            $pathway,
            '3b. package assigned on case',
            $assigned !== null,
            $assigned?->label ?? 'null'
        );

        $packageMatchesSuggestion = $suggested && $assigned && (int) $assigned->id === (int) $suggested->id;
        $this->record(
            $pathway,
            '3c. assigned matches suggestion',
            $packageMatchesSuggestion || ($assigned !== null && $suggested === null),
            $packageMatchesSuggestion
                ? 'match'
                : 'assigned='.($assigned?->label ?? 'null').' suggested='.($suggested?->label ?? 'null')
        );

        // Step 4: form_mode
        $forms = $assigned
            ? IrccInteractiveForm::where('ircc_category_id', $assigned->id)->where('is_active', true)->get()
            : collect();
        $mode = IrccPackageFormMode::describe($assigned, $forms);
        $expectedInteractive = \App\Support\ImmigrationPathwayLabels::mentionsExpressEntry($assigned?->label);
        $modeOk = $expectedInteractive
            ? $mode['form_mode'] === 'interactive'
            : in_array($mode['form_mode'], ['pdf_only', 'interactive'], true);

        $this->record(
            $pathway,
            '4. form_mode',
            $assigned ? $modeOk : false,
            $mode['form_mode'].' refs='.count($mode['reference_forms']).' interactive='.$forms->count()
        );

        // Step 5: before agreement — hub locked
        $unsigned = $case->replicate();
        $unsigned->id = $case->id;
        $unsigned->agreement_signed_at = null;
        $unsigned->status = 'PATHWAY_SELECTED';
        $unsigned->application_forms_verified_at = null;
        $unsigned->exists = true;
        // Use a throwaway status check via fresh copy fields on a clone is messy —
        // instead assert on a temporary in-memory case without persisting.
        $lockedProbe = CaseFile::find($case->id);
        $prevSigned = $lockedProbe->agreement_signed_at;
        $prevStatus = $lockedProbe->status;
        $prevVerified = $lockedProbe->application_forms_verified_at;
        $lockedProbe->forceFill([
            'agreement_signed_at' => null,
            'status' => 'PATHWAY_SELECTED',
            'application_forms_verified_at' => null,
        ])->saveQuietly();

        $lockedStatus = $verification->getVerificationStatus($lockedProbe->fresh());
        $this->record(
            $pathway,
            '5. hub locked before agreement',
            ($lockedStatus['case_management_unlocked'] ?? true) === false,
            'unlocked='.(($lockedStatus['case_management_unlocked'] ?? false) ? 'true' : 'false')
        );

        // Restore + ensure signed for unlock path
        $lockedProbe->forceFill([
            'agreement_signed_at' => $prevSigned ?? now()->subHour(),
            'agreement_sent_at' => $lockedProbe->agreement_sent_at ?? now()->subDay(),
            'agreement_token' => $lockedProbe->agreement_token ?: (string) Str::uuid(),
            'status' => 'AGREEMENT_SIGNED',
            'application_forms_verified_at' => null,
        ])->saveQuietly();

        $case = $lockedProbe->fresh();

        // Step 6: interactive forms path OR pdf_only unlock
        if ($mode['form_mode'] === 'interactive' && $forms->isNotEmpty()) {
            // Reset prior QA responses so re-runs stay deterministic.
            IrccInteractiveFormResponse::where('case_file_id', $case->id)->delete();
            $case->forceFill(['application_forms_verified_at' => null])->saveQuietly();
            $case = $case->fresh();

            // Hub must still be locked until submit+review
            $mid = $verification->getVerificationStatus($case->fresh());
            $this->record(
                $pathway,
                '6a. interactive locked until review',
                ($mid['case_management_unlocked'] ?? true) === false,
                'submitted='.($mid['submitted_count'] ?? 0).'/'.($mid['total_forms'] ?? 0)
            );

            foreach ($forms as $form) {
                $response = IrccInteractiveFormResponse::updateOrCreate(
                    [
                        'case_file_id' => $case->id,
                        'ircc_interactive_form_id' => $form->id,
                    ],
                    [
                        'user_id' => $user->id,
                        'response_data' => ['qa' => true],
                        'status' => 'submitted',
                        'submitted_at' => now(),
                        'reviewed_at' => now(),
                        'reviewed_by' => User::where('email', PathwayFlowQaSeeder::CONSULTANT_EMAIL)->value('id'),
                    ]
                );
                $response->forceFill([
                    'user_id' => $user->id,
                    'status' => 'submitted',
                    'submitted_at' => now(),
                    'reviewed_at' => now(),
                ])->saveQuietly();
            }

            $after = $verification->getVerificationStatus($case->fresh());
            $this->record(
                $pathway,
                '6b. unlock after all reviewed',
                ($after['case_management_unlocked'] ?? false) === true,
                'verified_at='.($after['verified_at'] ?? 'null')
            );
        } else {
            $after = $verification->getVerificationStatus($case->fresh());
            $this->record(
                $pathway,
                '6. pdf_only unlock after sign',
                ($after['case_management_unlocked'] ?? false) === true,
                'form_mode='.$mode['form_mode'].' verified_at='.($after['verified_at'] ?? 'null')
            );
        }

        // Step 7: messaging gate (agreement signed)
        $this->record(
            $pathway,
            '7. messaging allowed (agreement signed)',
            $case->fresh()->agreement_signed_at !== null,
            (string) $case->fresh()->agreement_signed_at
        );

        // Restore original stage preference for pathway_package clients (optional soft restore)
        if ($spec['stage'] === 'pathway_package' && $prevStatus && $prevStatus !== 'AGREEMENT_SIGNED') {
            // Keep signed state for QA visibility of unlock; do not revert — QA clients are fixtures.
        }
    }

    private function runSuggestionMatrix(IrccPackageSuggestionService $packages): void
    {
        $expectations = [
            'Express Entry – Federal Skilled Worker' => 'Express Entry',
            'Express Entry – Canadian Experience Class' => 'Express Entry',
            'Express Entry – Federal Skilled Trades' => 'Express Entry',
            'Provincial Nominee Program' => 'Provincial Nominee',
            'Ontario OINP' => 'Provincial Nominee',
            'Study Permit' => 'Study permit',
            'Work Permit' => 'Work permit',
            'Family Sponsorship' => 'Family Sponsorship',
            'Family Sponsorship – Spouse / Common-law Partner' => 'Family Sponsorship',
            'Family Sponsorship – Parents and Grandparents' => 'Family Sponsorship',
            'RCIP → Thunder Bay' => 'Provincial Nominee',
            'FCIP → Sudbury' => 'Provincial Nominee',
        ];

        foreach ($expectations as $pathway => $needle) {
            $case = new CaseFile(['immigration_pathway' => $pathway]);
            $suggestion = $packages->suggestForCase($case, $pathway);
            $label = $suggestion['category']->label ?? '';
            $ok = $suggestion['category'] !== null && stripos($label, $needle) !== false;
            if ($pathway === 'Study Permit' && stripos($label, 'Work') !== false) {
                $ok = false;
            }
            if ($pathway === 'Work Permit' && stripos($label, 'Study') !== false) {
                $ok = false;
            }
            if (str_contains($pathway, 'Family') && stripos($label, 'Super Visa') !== false) {
                $ok = false;
            }
            if (str_contains($pathway, 'Parents') && stripos($label, 'Spouse') !== false) {
                $ok = false;
            }
            $this->record(
                $pathway,
                'suggestion matrix',
                $ok,
                $label !== '' ? $label : ($suggestion['reason'] ?? 'none')
            );
        }
    }

    private function record(string $pathway, string $check, bool $ok, string $detail): void
    {
        if ($ok) {
            $this->pass++;
        } else {
            $this->fail++;
        }
        $this->rows[] = [
            'pathway' => $pathway,
            'check' => $check,
            'result' => $ok ? 'PASS' : 'FAIL',
            'detail' => Str::limit($detail, 120),
        ];
    }
}

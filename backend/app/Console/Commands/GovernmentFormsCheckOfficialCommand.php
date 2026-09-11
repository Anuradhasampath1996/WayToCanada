<?php

namespace App\Console\Commands;

use App\Services\GovernmentForms\GovernmentFormOfficialSyncService;
use Illuminate\Console\Command;

class GovernmentFormsCheckOfficialCommand extends Command
{
    protected $signature = 'government-forms:check-official
        {--form= : Optional single form code e.g. IMM0008}';

    protected $description = 'Check Canada.ca for official IRCC PDF updates and create draft autofill versions when hashes change (does not auto-activate).';

    public function handle(GovernmentFormOfficialSyncService $sync): int
    {
        $form = $this->option('form');
        $form = is_string($form) && trim($form) !== '' ? trim($form) : null;

        $this->info($form
            ? "Checking official template for {$form}…"
            : 'Checking official templates for all supported autofill forms…');

        $result = $sync->sync($form);
        $summary = $result['summary'];

        $this->table(
            ['Outcome', 'Count'],
            collect($summary)->map(fn ($count, $key) => [$key, $count])->values()->all()
        );

        foreach ($result['results'] as $row) {
            $code = $row['form_code'] ?? '?';
            $outcome = $row['outcome'] ?? '?';
            $message = $row['message'] ?? '';
            $this->line("[{$outcome}] {$code} — {$message}");
        }

        $errors = (int) ($summary['error'] ?? 0);

        return $errors > 0 ? self::FAILURE : self::SUCCESS;
    }
}

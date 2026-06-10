<?php

namespace App\Console\Commands;

use App\Services\CanadaTaxSyncService;
use Illuminate\Console\Command;

class SyncCanadaTaxRates extends Command
{
    protected $signature = 'tax:sync';

    protected $description = 'Sync Canadian tax rates from config and probe CRA government pages for changes';

    public function handle(CanadaTaxSyncService $sync): int
    {
        $this->info('Syncing Canada tax rates…');

        $result = $sync->sync();

        if ($result['rates_updated'] ?? false) {
            $this->info('Tax rates updated to version '.$result['version'].'.');
        } else {
            $this->info('Tax rates already at version '.$result['version'].'.');
        }

        if ($result['government_pages_changed'] ?? false) {
            $this->warn('CRA government pages have changed — review config/canada_tax_rates.php and bump version.');
        }

        foreach ($result['source_probes'] ?? [] as $key => $probe) {
            $status = $probe['status'] ?? 'unknown';
            $this->line("  [{$key}] {$status}");
        }

        return self::SUCCESS;
    }
}

<?php

namespace App\Console\Commands;

use App\Services\CrsRulesSyncService;
use Illuminate\Console\Command;

class SyncCrsRules extends Command
{
    protected $signature = 'crs:sync';

    protected $description = 'Sync CRS scoring rules and Express Entry draw data from IRCC sources';

    public function handle(CrsRulesSyncService $sync): int
    {
        $this->info('Syncing CRS rules and Express Entry draws…');
        $result = $sync->sync();

        $this->line('Version: '.($result['version'] ?? 'unknown'));
        $this->line('Rules updated: '.($result['rules_updated'] ? 'yes' : 'no'));
        $this->line('Draws synced: '.($result['draws_synced'] ?? 0));

        if ($result['ircc_probe']) {
            $this->line('IRCC probe: '.json_encode($result['ircc_probe']));
        }

        $this->info('CRS sync complete.');

        return self::SUCCESS;
    }
}

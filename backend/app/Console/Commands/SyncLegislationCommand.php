<?php

namespace App\Console\Commands;

use App\Models\LegislationSyncRun;
use App\Services\LegislationSyncService;
use Illuminate\Console\Command;

class SyncLegislationCommand extends Command
{
    protected $signature = 'legislation:sync {source? : Source slug (irpa, irpr) or omit for all}';

    protected $description = 'Sync Canadian legislation documents from Justice Laws';

    public function handle(LegislationSyncService $sync): int
    {
        $source = $this->argument('source');
        $run = $sync->startSyncRun($source ? 'source' : 'all', $source);

        $this->info('Syncing legislation'.($source ? ": {$source}" : ' (all sources)'));

        $stats = $sync->runSync($run, $source);

        $this->info(sprintf(
            'Done. Created: %d, Updated: %d, Errors: %d',
            $stats['created'],
            $stats['updated'],
            count($stats['errors'])
        ));

        foreach ($stats['errors'] as $err) {
            $this->warn($err);
        }

        return empty($stats['errors']) ? self::SUCCESS : self::FAILURE;
    }
}

<?php

namespace App\Console\Commands;

use App\Jobs\RunRcicRegisterSyncJob;
use App\Services\RcicRegisterSyncService;
use Illuminate\Console\Command;

class SyncRcicRegisterCommand extends Command
{
    protected $signature = 'rcic:sync-register
                            {--sync : Run synchronously in this process instead of queueing}
                            {--trigger=scheduled : Run trigger label (scheduled|artisan|manual)}';

    protected $description = 'Sync RCIC consultants from the CICC public register (queued by default)';

    public function handle(RcicRegisterSyncService $sync): int
    {
        if ($sync->hasActiveRun()) {
            $this->warn('An RCIC register sync is already pending or running. Skipping.');

            return self::SUCCESS;
        }

        $trigger = (string) $this->option('trigger');
        $run = $sync->startSyncRun($trigger);

        if (! $run) {
            $this->warn('Could not start sync run (another sync may have started).');

            return self::FAILURE;
        }

        $this->info("RCIC register sync run #{$run->id} created (trigger={$trigger}).");

        if ($this->option('sync') || config('queue.default') === 'sync') {
            $this->info('Running sync in-process…');
            $stats = $sync->runSync($run->fresh());
            $this->line('Created: '.($stats['created'] ?? 0));
            $this->line('Updated: '.($stats['updated'] ?? 0));
            $this->line('Errors: '.($stats['errors'] ?? 0));
            $this->line('Not found: '.($stats['not_found'] ?? 0));
            $this->info('Done.');

            return self::SUCCESS;
        }

        RunRcicRegisterSyncJob::dispatch($run->id);
        $this->info('Sync job dispatched to the queue. Ensure `php artisan queue:work` is running.');

        return self::SUCCESS;
    }
}

<?php

namespace App\Console\Commands;

use App\Services\GstHstSyncService;
use Illuminate\Console\Command;

class SyncGstHstRates extends Command
{
    protected $signature = 'gst-hst:sync';

    protected $description = 'Sync GST/HST/PST sales tax rates from config for payments';

    public function handle(GstHstSyncService $sync): int
    {
        $this->info('Syncing GST/HST rates…');
        $result = $sync->sync();

        if ($result['rates_updated'] ?? false) {
            $this->info('Rates updated to version '.$result['version'].'.');
        } else {
            $this->info('Rates already at version '.$result['version'].'.');
        }

        return self::SUCCESS;
    }
}

<?php

namespace App\Console\Commands;

use App\Http\Controllers\IrccNewsController;
use Illuminate\Console\Command;

class FetchIrccNews extends Command
{
    protected $signature   = 'ircc:fetch-news';
    protected $description = 'Fetch and cache the latest IRCC news from the Government of Canada RSS feed.';

    public function handle(IrccNewsController $controller): int
    {
        $this->info('Fetching IRCC news feed…');

        try {
            $items = $controller->fetchAndPersist();
            $this->info("Done. {$items->count()} items in cache.");

            if ($items->isEmpty()) {
                $this->warn('No items cached — check laravel.log for feed errors.');
            }
        } catch (\Throwable $e) {
            $this->error('Failed: ' . $e->getMessage());
            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}

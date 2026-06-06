<?php

namespace App\Console\Commands;

use App\Services\IrccFormsSyncService;
use Illuminate\Console\Command;

class SyncIrccForms extends Command
{
    protected $signature = 'ircc:sync-forms {--catalog-only : Only refresh the form catalog from canada.ca} {--packages-only : Only sync documents into application packages}';

    protected $description = 'Sync IRCC forms catalog and application package documents from canada.ca';

    public function handle(IrccFormsSyncService $sync): int
    {
        $catalogOnly  = (bool) $this->option('catalog-only');
        $packagesOnly = (bool) $this->option('packages-only');

        if (! $packagesOnly) {
            $this->info('Fetching IRCC form catalog from canada.ca…');
            $catalog = $sync->syncCatalog();
            $this->line("Catalog: {$catalog['total']} forms, {$catalog['created']} new, {$catalog['updated']} updated, {$catalog['pdf_resolved']} PDFs resolved.");
            foreach ($catalog['errors'] as $err) {
                $this->warn($err);
            }
        }

        if (! $catalogOnly) {
            $this->info('Syncing application package documents…');
            $packages = $sync->syncAllPackages();
            $this->line("Packages: {$packages['packages']} processed, {$packages['downloaded']} downloaded, {$packages['updated']} updated, {$packages['skipped']} unchanged.");
            foreach ($packages['errors'] as $err) {
                $this->warn($err);
            }
        }

        return self::SUCCESS;
    }
}

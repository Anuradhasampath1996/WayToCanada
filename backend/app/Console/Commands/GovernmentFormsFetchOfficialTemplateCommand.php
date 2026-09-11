<?php

namespace App\Console\Commands;

use App\Services\GovernmentForms\GovernmentFormOfficialSyncService;
use App\Services\IrccFormsSyncService;
use Illuminate\Console\Command;

class GovernmentFormsFetchOfficialTemplateCommand extends Command
{
    protected $signature = 'government-forms:fetch-official
        {form=IMM5476 : Form code e.g. IMM5476 or IMM 5476}
        {--page-url= : Override official Canada.ca form page URL}
        {--register-draft : Also create a mapping-review draft version when hash differs from active}';

    protected $description = 'Download the current official IRCC PDF template from Canada.ca.';

    public function handle(GovernmentFormOfficialSyncService $sync): int
    {
        $normalized = IrccFormsSyncService::normalizeReference($this->argument('form'));
        $formCode = strtoupper($normalized);
        $pageUrl = $this->option('page-url') ?: $sync->pageUrlFor($formCode);

        if (! $pageUrl) {
            $this->error('No official page URL configured for this form. Pass --page-url= or add government_forms.official_page_urls.');

            return self::FAILURE;
        }

        $this->info("Fetching official page: {$pageUrl}");

        try {
            if ($this->option('register-draft')) {
                $result = $sync->syncOne($formCode, $pageUrl);
                $this->line('Outcome: '.($result['outcome'] ?? 'unknown'));
                $this->line($result['message'] ?? '');
                if (! empty($result['official_sha256'])) {
                    $this->line('SHA-256: '.$result['official_sha256']);
                }
                if (! empty($result['draft_version_id'])) {
                    $this->line('Draft version id: '.$result['draft_version_id']);
                }
                if (! empty($result['storage_path'])) {
                    $this->line('Storage path: storage/app/private/'.$result['storage_path']);
                }

                return ($result['outcome'] ?? '') === 'error' ? self::FAILURE : self::SUCCESS;
            }

            $fetched = $sync->fetchOfficialPdf($pageUrl);
            $storagePath = $sync->storeTemplateBytes($formCode, $fetched['sha256'], $fetched['bytes']);

            $this->line('Official version label: '.($fetched['version_label'] ?: 'unknown'));
            $this->line('Page last updated: '.($fetched['page_last_updated'] ?: 'unknown'));
            $this->line('Official PDF URL: '.$fetched['pdf_url']);
            $this->newLine();
            $this->info('Official template stored.');
            $this->line('Storage path: storage/app/private/'.$storagePath);
            $this->line('SHA-256: '.$fetched['sha256']);
        } catch (\Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}

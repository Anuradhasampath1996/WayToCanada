<?php

namespace App\Console\Commands;

use App\Services\GovernmentForms\GovernmentFormRegistryService;
use Illuminate\Console\Command;

class GovernmentFormsEnsureTemplatesCommand extends Command
{
    protected $signature = 'government-forms:ensure-templates';

    protected $description = 'Download missing ACTIVE official autofill PDF templates into private storage from Canada.ca (hash must match).';

    public function handle(GovernmentFormRegistryService $registry): int
    {
        $this->info('Ensuring active government form templates are present in private storage…');

        $result = $registry->ensureAllActiveTemplates();

        $this->line("Already present: {$result['already_present']}");
        $this->line("Restored: {$result['restored']}");
        $this->line('Failed: '.count($result['failed']));

        foreach ($result['failed'] as $row) {
            $this->error("[{$row['form_code']}] {$row['message']}");
        }

        return $result['failed'] === [] ? self::SUCCESS : self::FAILURE;
    }
}

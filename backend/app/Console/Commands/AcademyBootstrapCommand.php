<?php

namespace App\Console\Commands;

use App\Services\Academy\AcademyBootstrap;
use Illuminate\Console\Command;

class AcademyBootstrapCommand extends Command
{
    protected $signature = 'academy:bootstrap';

    protected $description = 'Idempotently seed RCIC Academy taxonomy and the IRB exam template';

    public function handle(AcademyBootstrap $bootstrap): int
    {
        $bootstrap->ensure();
        $this->info('Academy taxonomy and IRB exam template are up to date.');

        return self::SUCCESS;
    }
}

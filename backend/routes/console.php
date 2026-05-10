<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ── Fetch and cache IRCC news every 24 hours ──────────────────────────────────
// On Linux/Mac production server, add to crontab:
//   * * * * * cd /path/to/project && php artisan schedule:run >> /dev/null 2>&1
Schedule::command('ircc:fetch-news')->daily()->timezone('America/Toronto');

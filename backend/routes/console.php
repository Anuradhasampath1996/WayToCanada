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

// Sync IRCC forms & guides from canada.ca daily (catalog + package PDFs)
Schedule::command('ircc:sync-forms')->dailyAt('03:00')->timezone('America/Toronto');

// Sync CRS scoring rules + Express Entry draw cut-offs daily
Schedule::command('crs:sync')->dailyAt('04:00')->timezone('America/Toronto');

// Sync Canadian legislation (IRPA, IRPR) daily
Schedule::command('legislation:sync')->dailyAt('05:00')->timezone('America/Toronto');

// Sync GST/HST/PST sales tax rates for payments
Schedule::command('gst-hst:sync')->dailyAt('06:30')->timezone('America/Toronto');

// Unsigned retainer agreement reminders (email + optional Twilio WhatsApp)
Schedule::command('agreements:send-reminders')->dailyAt('09:00')->timezone('America/Toronto');

// Video meeting reminders (24h + 1h before)
Schedule::command('meetings:send-reminders')->everyFifteenMinutes()->timezone('America/Toronto');

// Unpaid client payment request reminders
Schedule::command('payments:send-reminders')->dailyAt('09:30')->timezone('America/Toronto');

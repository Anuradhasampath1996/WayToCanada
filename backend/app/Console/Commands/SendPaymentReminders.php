<?php

namespace App\Console\Commands;

use App\Services\Notifications\PaymentReminderService;
use Illuminate\Console\Command;

class SendPaymentReminders extends Command
{
    protected $signature = 'payments:send-reminders';

    protected $description = 'Remind clients about unpaid payment requests older than 3 days';

    public function handle(PaymentReminderService $service): int
    {
        $count = $service->sendDueReminders();
        $this->info("Sent payment reminders for {$count} request(s).");

        return self::SUCCESS;
    }
}

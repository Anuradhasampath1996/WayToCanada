<?php

namespace App\Console\Commands;

use App\Services\Notifications\MeetingReminderService;
use Illuminate\Console\Command;

class SendMeetingReminders extends Command
{
    protected $signature = 'meetings:send-reminders';

    protected $description = 'Send 24h and 1h video meeting reminders to clients and consultants';

    public function handle(MeetingReminderService $service): int
    {
        $count = $service->sendDueReminders();
        $this->info("Processed {$count} meeting reminder window(s).");

        return self::SUCCESS;
    }
}

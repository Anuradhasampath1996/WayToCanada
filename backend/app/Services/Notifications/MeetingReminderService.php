<?php

namespace App\Services\Notifications;

use App\Models\ClientMeeting;
use Carbon\Carbon;

class MeetingReminderService
{
    public function __construct(
        private WorkspaceNotificationTriggers $triggers,
    ) {}

    public function sendDueReminders(): int
    {
        $sent = 0;
        $sent += $this->processWindow('24h', 24 * 60, 15);
        $sent += $this->processWindow('1h', 60, 10);

        return $sent;
    }

    private function processWindow(string $window, int $targetMinutes, int $toleranceMinutes): int
    {
        $from = Carbon::now()->addMinutes($targetMinutes - $toleranceMinutes);
        $to   = Carbon::now()->addMinutes($targetMinutes + $toleranceMinutes);

        $meetings = ClientMeeting::where('status', 'scheduled')
            ->whereBetween('scheduled_at', [$from, $to])
            ->get();

        $count = 0;
        foreach ($meetings as $meeting) {
            $this->triggers->onMeetingReminder($meeting, $window);
            $count++;
        }

        return $count;
    }
}

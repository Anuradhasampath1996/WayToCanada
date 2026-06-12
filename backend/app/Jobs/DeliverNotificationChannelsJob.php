<?php

namespace App\Jobs;

use App\Models\UserNotification;
use App\Services\Notifications\NotificationOrchestrator;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DeliverNotificationChannelsJob implements ShouldQueue
{
    use Queueable;

    /** @param list<string> $channels */
    public function __construct(
        public int $notificationId,
        public array $channels,
    ) {}

    public function handle(NotificationOrchestrator $orchestrator): void
    {
        $notification = UserNotification::with('user')->find($this->notificationId);
        if (! $notification) {
            return;
        }

        $orchestrator->deliverAsync($notification, $this->channels);
    }
}

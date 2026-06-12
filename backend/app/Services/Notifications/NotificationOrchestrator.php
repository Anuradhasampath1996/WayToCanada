<?php

namespace App\Services\Notifications;

use App\Enums\NotificationType;
use App\Models\UserNotification;
use App\Services\Notifications\Channels\EmailNotificationChannel;
use App\Services\Notifications\Channels\InAppNotificationChannel;
use App\Services\Notifications\Channels\WhatsAppNotificationChannel;
use App\Jobs\DeliverNotificationChannelsJob;

class NotificationOrchestrator
{
    public function __construct(
        private NotificationPreferenceService $preferences,
        private InAppNotificationChannel $inApp,
        private EmailNotificationChannel $email,
        private WhatsAppNotificationChannel $whatsapp,
    ) {}

    /** @param list<string>|null $channels */
    public function deliver(UserNotification $notification, NotificationType $type, ?array $channels = null): void
    {
        $notification->loadMissing('user');
        $channels = $channels ?? $type->defaultChannels();
        $channels = $this->preferences->filterChannels($notification->user, $type, $channels);

        $async = array_values(array_filter($channels, fn ($c) => in_array($c, ['email', 'whatsapp'], true)));
        $sync  = array_values(array_filter($channels, fn ($c) => $c === 'in_app'));

        foreach ($sync as $channel) {
            if ($channel === 'in_app') {
                $this->inApp->deliver($notification);
            }
        }

        if ($async === []) {
            return;
        }

        if (config('queue.default') === 'sync') {
            $this->deliverAsync($notification, $async);

            return;
        }

        DeliverNotificationChannelsJob::dispatch($notification->id, $async);
    }

    /** @param list<string> $channels */
    public function deliverAsync(UserNotification $notification, array $channels): void
    {
        foreach ($channels as $channel) {
            match ($channel) {
                'email'    => $this->email->deliver($notification),
                'whatsapp' => $this->whatsapp->deliver($notification),
                default    => null,
            };
        }
    }
}

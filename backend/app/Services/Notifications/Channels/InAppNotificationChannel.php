<?php

namespace App\Services\Notifications\Channels;

use App\Models\NotificationDelivery;
use App\Models\UserNotification;

class InAppNotificationChannel
{
    public function deliver(UserNotification $notification): NotificationDelivery
    {
        return NotificationDelivery::create([
            'user_notification_id' => $notification->id,
            'channel'              => 'in_app',
            'status'               => 'sent',
            'sent_at'              => now(),
        ]);
    }
}

<?php

namespace App\Services\Notifications\Channels;

use App\Mail\GenericNotificationEmail;
use App\Models\NotificationDelivery;
use App\Models\UserNotification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EmailNotificationChannel
{
    public function deliver(UserNotification $notification): NotificationDelivery
    {
        $delivery = NotificationDelivery::create([
            'user_notification_id' => $notification->id,
            'channel'              => 'email',
            'status'               => 'pending',
        ]);

        $user = $notification->user;
        if (! $user?->email) {
            return $this->fail($delivery, 'No email address on file.');
        }

        try {
            Mail::to($user->email)->send(new GenericNotificationEmail($notification));
            $delivery->update(['status' => 'sent', 'sent_at' => now()]);

            return $delivery->fresh();
        } catch (\Throwable $e) {
            Log::warning('Notification email failed', [
                'notification_id' => $notification->id,
                'error'           => $e->getMessage(),
            ]);

            return $this->fail($delivery, $e->getMessage());
        }
    }

    private function fail(NotificationDelivery $delivery, string $error): NotificationDelivery
    {
        $delivery->update(['status' => 'failed', 'error_message' => substr($error, 0, 500)]);

        return $delivery->fresh();
    }
}

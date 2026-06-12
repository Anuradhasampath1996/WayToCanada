<?php

namespace App\Services\Notifications\Channels;

use App\Models\NotificationDelivery;
use App\Models\UserNotification;
use App\Services\AgreementReminderService;
use App\Services\Notifications\NotificationPhoneResolver;
use Illuminate\Support\Facades\Log;

class WhatsAppNotificationChannel
{
    public function __construct(
        private NotificationPhoneResolver $phones,
        private AgreementReminderService $twilio,
    ) {}

    public function deliver(UserNotification $notification): NotificationDelivery
    {
        $delivery = NotificationDelivery::create([
            'user_notification_id' => $notification->id,
            'channel'              => 'whatsapp',
            'status'               => 'pending',
        ]);

        $user = $notification->user;
        $phone = $user ? $this->phones->resolveForUser($user) : null;

        if (! $phone) {
            return $this->skip($delivery, 'No phone number on file.');
        }

        $message = $notification->title . "\n\n" . $notification->body;
        if ($notification->action_url) {
            $message .= "\n\n" . $notification->action_url;
        }

        $result = $this->twilio->sendViaTwilio($phone, $message);

        if ($result['sent']) {
            $delivery->update(['status' => 'sent', 'sent_at' => now()]);

            return $delivery->fresh();
        }

        if ($result['error'] === null) {
            return $this->skip($delivery, 'Twilio not configured.');
        }

        Log::warning('Notification WhatsApp failed', [
            'notification_id' => $notification->id,
            'error'           => $result['error'],
        ]);

        return $this->fail($delivery, $result['error']);
    }

    private function skip(NotificationDelivery $delivery, string $reason): NotificationDelivery
    {
        $delivery->update(['status' => 'skipped', 'error_message' => substr($reason, 0, 500)]);

        return $delivery->fresh();
    }

    private function fail(NotificationDelivery $delivery, string $error): NotificationDelivery
    {
        $delivery->update(['status' => 'failed', 'error_message' => substr($error, 0, 500)]);

        return $delivery->fresh();
    }
}

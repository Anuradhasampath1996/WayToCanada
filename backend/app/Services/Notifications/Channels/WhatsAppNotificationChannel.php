<?php

namespace App\Services\Notifications\Channels;

use App\Models\NotificationDelivery;
use App\Models\UserNotification;
use App\Services\Notifications\NotificationPhoneResolver;
use App\Services\Notifications\WhatsAppMessageBuilder;
use App\Services\WhatsApp\WhatsAppDeliveryService;
use Illuminate\Support\Facades\Log;

class WhatsAppNotificationChannel
{
    public function __construct(
        private NotificationPhoneResolver $phones,
        private WhatsAppMessageBuilder $messages,
        private WhatsAppDeliveryService $delivery,
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

        $structured = $this->messages->buildStructuredFromNotification($notification);
        $result = $this->delivery->send($phone, $structured);

        if ($result['sent']) {
            $provider = $result['provider'] ?? 'whatsapp';
            $delivery->update([
                'status'               => 'sent',
                'sent_at'              => now(),
                'provider_message_id'=> $provider,
            ]);

            return $delivery->fresh();
        }

        if ($result['error'] === null) {
            return $this->skip($delivery, 'WhatsApp provider not configured.');
        }

        Log::warning('Notification WhatsApp failed', [
            'notification_id' => $notification->id,
            'provider'        => $result['provider'] ?? null,
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

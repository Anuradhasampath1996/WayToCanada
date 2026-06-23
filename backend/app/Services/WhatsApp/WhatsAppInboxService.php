<?php

namespace App\Services\WhatsApp;

use App\Models\ClientProfile;
use App\Models\User;
use App\Models\WhatsAppConversation;
use App\Models\WhatsAppMessage;
class WhatsAppInboxService
{
    public function __construct(
        private MetaWhatsAppCloudService $metaWhatsApp,
        private TwilioWhatsAppService $phoneNormalizer,
    ) {}

    public function findOrCreateConversation(string $waId, ?string $contactName = null): WhatsAppConversation
    {
        $waId = $this->normalizeWaId($waId);

        $conversation = WhatsAppConversation::query()->firstOrCreate(
            ['wa_id' => $waId],
            [
                'contact_name' => $contactName,
                'user_id'      => $this->resolveUserId($waId),
            ],
        );

        if ($contactName && ! $conversation->contact_name) {
            $conversation->update(['contact_name' => $contactName]);
        }

        if (! $conversation->user_id) {
            $userId = $this->resolveUserId($waId);
            if ($userId) {
                $conversation->update(['user_id' => $userId]);
            }
        }

        return $conversation->fresh(['user:id,name,email,role']);
    }

    /** @param array<string, mixed> $metadata */
    public function recordInbound(
        WhatsAppConversation $conversation,
        string $waMessageId,
        string $messageType,
        ?string $body,
        array $metadata = [],
    ): WhatsAppMessage {
        if (WhatsAppMessage::query()->where('wa_message_id', $waMessageId)->exists()) {
            return WhatsAppMessage::query()->where('wa_message_id', $waMessageId)->firstOrFail();
        }

        $preview = $this->previewText($body, $messageType);

        $message = WhatsAppMessage::create([
            'whatsapp_conversation_id' => $conversation->id,
            'direction'                => 'inbound',
            'wa_message_id'            => $waMessageId,
            'message_type'             => $messageType,
            'body'                     => $body,
            'status'                   => 'received',
            'metadata'                 => $metadata ?: null,
        ]);

        $conversation->update([
            'last_message_at'       => now(),
            'last_message_preview'  => $preview,
            'unread_count'          => $conversation->unread_count + 1,
            'session_expires_at'    => now()->addHours(24),
        ]);

        return $message;
    }

    /** @return array{message: WhatsAppMessage, error: string|null} */
    public function sendReply(WhatsAppConversation $conversation, string $body, int $adminUserId): array
    {
        $body = trim($body);
        if ($body === '') {
            return ['message' => new WhatsAppMessage, 'error' => 'Message cannot be empty.'];
        }

        if (! $conversation->hasOpenSession()) {
            return [
                'message' => new WhatsAppMessage,
                'error'   => 'The 24-hour reply window is closed. Ask the contact to message your WhatsApp number first, or send a template notification from the platform.',
            ];
        }

        if (strlen($body) > 4096) {
            return ['message' => new WhatsAppMessage, 'error' => 'Message is too long (max 4096 characters).'];
        }

        $result = $this->metaWhatsApp->sendText('+' . $conversation->wa_id, $body);
        if (! $result['sent']) {
            return [
                'message' => new WhatsAppMessage,
                'error'   => $result['error'] ?? 'Failed to send WhatsApp message.',
            ];
        }

        $message = WhatsAppMessage::create([
            'whatsapp_conversation_id' => $conversation->id,
            'direction'                => 'outbound',
            'wa_message_id'            => $result['message_id'],
            'message_type'             => 'text',
            'body'                     => $body,
            'status'                   => 'sent',
            'sent_by_user_id'          => $adminUserId,
        ]);

        $conversation->update([
            'last_message_at'      => now(),
            'last_message_preview' => $this->previewText($body, 'text'),
        ]);

        return ['message' => $message->load('sentBy:id,name,email'), 'error' => null];
    }

    public function markRead(WhatsAppConversation $conversation): void
    {
        if ($conversation->unread_count > 0) {
            $conversation->update(['unread_count' => 0]);
        }
    }

    public function updateMessageStatus(string $waMessageId, string $status): void
    {
        WhatsAppMessage::query()
            ->where('wa_message_id', $waMessageId)
            ->where('direction', 'outbound')
            ->update(['status' => $status]);
    }

    private function normalizeWaId(string $waId): string
    {
        return $this->phoneNormalizer->normalizeDigits($waId) ?? preg_replace('/\D/', '', $waId);
    }

    private function resolveUserId(string $waId): ?int
    {
        $user = User::query()
            ->where(function ($q) use ($waId) {
                $q->whereRaw("regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = ?", [$waId])
                    ->orWhereRaw("regexp_replace(coalesce(company_phone, ''), '[^0-9]', '', 'g') = ?", [$waId])
                    ->orWhereRaw("right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = right(?, 10)", [$waId])
                    ->orWhereRaw("right(regexp_replace(coalesce(company_phone, ''), '[^0-9]', '', 'g'), 10) = right(?, 10)", [$waId]);
            })
            ->first(['id']);

        if ($user) {
            return $user->id;
        }

        $profile = ClientProfile::query()
            ->where(function ($q) use ($waId) {
                $q->whereRaw("regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = ?", [$waId])
                    ->orWhereRaw("right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = right(?, 10)", [$waId]);
            })
            ->first(['user_id']);

        return $profile?->user_id;
    }

    private function previewText(?string $body, string $messageType): string
    {
        if ($body) {
            return mb_strlen($body) > 500 ? mb_substr($body, 0, 497) . '...' : $body;
        }

        return match ($messageType) {
            'image'    => '[Image]',
            'audio'    => '[Audio]',
            'video'    => '[Video]',
            'document' => '[Document]',
            'sticker'  => '[Sticker]',
            'location' => '[Location]',
            default    => '[' . ucfirst($messageType) . ']',
        };
    }
}

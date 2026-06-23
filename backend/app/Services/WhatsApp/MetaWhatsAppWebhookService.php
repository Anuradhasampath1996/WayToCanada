<?php

namespace App\Services\WhatsApp;

use Illuminate\Support\Facades\Log;

class MetaWhatsAppWebhookService
{
    public function __construct(
        private WhatsAppInboxService $inbox,
    ) {}

    /** @param array<string, mixed> $payload */
    public function handle(array $payload): void
    {
        if (($payload['object'] ?? '') !== 'whatsapp_business_account') {
            return;
        }

        foreach ($payload['entry'] ?? [] as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                $value = $change['value'] ?? [];
                $this->handleContacts($value['contacts'] ?? []);
                $this->handleMessages($value['messages'] ?? []);
                $this->handleStatuses($value['statuses'] ?? []);
            }
        }
    }

    /** @param list<array<string, mixed>> $contacts */
    private function handleContacts(array $contacts): void
    {
        foreach ($contacts as $contact) {
            $waId = (string) ($contact['wa_id'] ?? '');
            $name = $contact['profile']['name'] ?? null;
            if ($waId !== '') {
                $this->inbox->findOrCreateConversation($waId, is_string($name) ? $name : null);
            }
        }
    }

    /** @param list<array<string, mixed>> $messages */
    private function handleMessages(array $messages): void
    {
        foreach ($messages as $item) {
            $from = (string) ($item['from'] ?? '');
            $waMessageId = (string) ($item['id'] ?? '');
            $type = (string) ($item['type'] ?? 'unknown');

            if ($from === '' || $waMessageId === '') {
                continue;
            }

            [$body, $metadata] = $this->extractMessageContent($type, $item);

            try {
                $conversation = $this->inbox->findOrCreateConversation($from);
                $this->inbox->recordInbound($conversation, $waMessageId, $type, $body, $metadata);
            } catch (\Throwable $e) {
                Log::warning('WhatsApp inbound message failed', [
                    'wa_message_id' => $waMessageId,
                    'error'         => $e->getMessage(),
                ]);
            }
        }
    }

    /** @param list<array<string, mixed>> $statuses */
    private function handleStatuses(array $statuses): void
    {
        foreach ($statuses as $status) {
            $waMessageId = (string) ($status['id'] ?? '');
            $state = (string) ($status['status'] ?? '');

            if ($waMessageId === '' || $state === '') {
                continue;
            }

            $this->inbox->updateMessageStatus($waMessageId, $state);
        }
    }

    /** @param array<string, mixed> $item @return array{0: ?string, 1: array<string, mixed>} */
    private function extractMessageContent(string $type, array $item): array
    {
        return match ($type) {
            'text' => [(string) ($item['text']['body'] ?? ''), []],
            'button' => [(string) ($item['button']['text'] ?? $item['button']['payload'] ?? ''), ['button' => $item['button'] ?? []]],
            'interactive' => [$this->extractInteractiveText($item['interactive'] ?? []), ['interactive' => $item['interactive'] ?? []]],
            'image', 'audio', 'video', 'document', 'sticker' => [
                null,
                [$type => $item[$type] ?? []],
            ],
            'location' => [
                $this->formatLocation($item['location'] ?? []),
                ['location' => $item['location'] ?? []],
            ],
            default => [null, ['raw' => $item]],
        };
    }

    /** @param array<string, mixed> $interactive */
    private function extractInteractiveText(array $interactive): ?string
    {
        if (isset($interactive['button_reply']['title'])) {
            return (string) $interactive['button_reply']['title'];
        }

        if (isset($interactive['list_reply']['title'])) {
            $title = (string) $interactive['list_reply']['title'];
            $desc = (string) ($interactive['list_reply']['description'] ?? '');

            return trim($title . ($desc !== '' ? "\n{$desc}" : ''));
        }

        return null;
    }

    /** @param array<string, mixed> $location */
    private function formatLocation(array $location): ?string
    {
        $name = (string) ($location['name'] ?? '');
        $address = (string) ($location['address'] ?? '');
        $lat = $location['latitude'] ?? null;
        $lng = $location['longitude'] ?? null;

        $parts = array_filter([$name, $address]);
        if ($lat !== null && $lng !== null) {
            $parts[] = "{$lat}, {$lng}";
        }

        return $parts ? implode("\n", $parts) : null;
    }
}

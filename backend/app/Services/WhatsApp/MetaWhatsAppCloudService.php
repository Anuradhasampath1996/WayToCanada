<?php

namespace App\Services\WhatsApp;

use App\Support\NotificationUrlBuilder;
use App\Support\WhatsAppStructuredMessage;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MetaWhatsAppCloudService
{
    /** @return array{sent: bool, error: string|null, provider: string, message_id: string|null} */
    public function sendText(string $phone, string $body): array
    {
        if (! $this->isConfigured()) {
            return ['sent' => false, 'error' => 'Meta WhatsApp Cloud API is not configured.', 'provider' => 'meta', 'message_id' => null];
        }

        $digits = app(TwilioWhatsAppService::class)->normalizeDigits($phone);
        if (! $digits) {
            return ['sent' => false, 'error' => 'Invalid phone number.', 'provider' => 'meta', 'message_id' => null];
        }

        return $this->postMessage([
            'messaging_product' => 'whatsapp',
            'to'                => $digits,
            'type'              => 'text',
            'text'              => [
                'preview_url' => false,
                'body'        => $body,
            ],
        ]);
    }

    /** @return array{sent: bool, error: string|null, provider: string, message_id: string|null} */
    public function sendStructured(string $phone, WhatsAppStructuredMessage $message): array
    {
        if (! $this->isConfigured()) {
            return ['sent' => false, 'error' => null, 'provider' => 'meta', 'message_id' => null];
        }

        $digits = app(TwilioWhatsAppService::class)->normalizeDigits($phone);
        if (! $digits) {
            return ['sent' => false, 'error' => 'Invalid phone number.', 'provider' => 'meta', 'message_id' => null];
        }

        $payload = [
            'messaging_product' => 'whatsapp',
            'to'                => $digits,
            'type'              => 'template',
            'template'          => [
                'name'     => $message->metaTemplateName(),
                'language' => ['code' => (string) config('services.whatsapp_cloud.language', 'en')],
                'components' => [
                    [
                        'type'       => 'body',
                        'parameters' => array_map(
                            static fn (string $text) => ['type' => 'text', 'text' => $text],
                            $message->metaBodyParameters(),
                        ),
                    ],
                ],
            ],
        ];

        return $this->postMessage($payload);
    }

    /** @return array{sent: bool, error: string|null, provider: string, message_id: string|null} */
    public function sendTest(string $phone): array
    {
        return $this->sendStructured($phone, new WhatsAppStructuredMessage(
            WhatsAppStructuredMessage::AUDIENCE_CONSULTANT,
            'there',
            'WhatsApp test message',
            'Your Meta WhatsApp Cloud API connection is working.',
            NotificationUrlBuilder::consultantBilling(),
        ));
    }

    public function isConfigured(): bool
    {
        return filled(config('services.whatsapp_cloud.phone_number_id'))
            && filled(config('services.whatsapp_cloud.access_token'));
    }

    /** @param array<string, mixed> $payload @return array{sent: bool, error: string|null, provider: string, message_id: string|null} */
    private function postMessage(array $payload): array
    {
        $version = (string) config('services.whatsapp_cloud.api_version', 'v21.0');
        $phoneNumberId = (string) config('services.whatsapp_cloud.phone_number_id');
        $token = (string) config('services.whatsapp_cloud.access_token');
        $url = "https://graph.facebook.com/{$version}/{$phoneNumberId}/messages";

        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->post($url, $payload);

            if ($response->successful()) {
                $messageId = $response->json('messages.0.id');

                return [
                    'sent'       => true,
                    'error'      => null,
                    'provider'   => 'meta',
                    'message_id' => is_string($messageId) ? $messageId : null,
                ];
            }

            $error = $response->json('error.message') ?? $response->body();

            Log::warning('Meta WhatsApp Cloud send failed', [
                'status' => $response->status(),
                'error'  => $error,
            ]);

            return [
                'sent'       => false,
                'error'      => is_string($error) ? $error : 'Meta WhatsApp API error.',
                'provider'   => 'meta',
                'message_id' => null,
            ];
        } catch (\Throwable $e) {
            Log::warning('Meta WhatsApp Cloud exception', ['message' => $e->getMessage()]);

            return ['sent' => false, 'error' => $e->getMessage(), 'provider' => 'meta', 'message_id' => null];
        }
    }
}

<?php

namespace App\Services\WhatsApp;

use App\Support\WhatsAppStructuredMessage;

class WhatsAppDeliveryService
{
    public function __construct(
        private MetaWhatsAppCloudService $meta,
        private TwilioWhatsAppService $twilio,
    ) {}

    /** @return array{sent: bool, error: string|null, provider: string|null} */
    public function send(string $phone, WhatsAppStructuredMessage $message): array
    {
        $preferred = (string) config('services.whatsapp.provider', 'meta');

        if ($preferred === 'twilio') {
            return $this->sendViaTwilioFirst($phone, $message);
        }

        return $this->sendViaMetaFirst($phone, $message);
    }

    /** @return array{sent: bool, error: string|null, provider: string|null} */
    private function sendViaMetaFirst(string $phone, WhatsAppStructuredMessage $message): array
    {
        $metaResult = null;

        if ($this->meta->isConfigured()) {
            $metaResult = $this->meta->sendStructured($phone, $message);
            if ($metaResult['sent']) {
                return $this->normalizeResult($metaResult);
            }
        }

        if ($this->twilio->isConfigured()) {
            return $this->normalizeResult(
                $this->twilio->sendText($phone, $message->toPlainText()),
            );
        }

        return $this->normalizeResult($metaResult ?? ['sent' => false, 'error' => null, 'provider' => 'meta']);
    }

    /** @return array{sent: bool, error: string|null, provider: string|null} */
    private function sendViaTwilioFirst(string $phone, WhatsAppStructuredMessage $message): array
    {
        if ($this->twilio->isConfigured()) {
            $result = $this->twilio->sendText($phone, $message->toPlainText());
            if ($result['sent']) {
                return $this->normalizeResult($result);
            }
        }

        if ($this->meta->isConfigured()) {
            return $this->normalizeResult($this->meta->sendStructured($phone, $message));
        }

        return ['sent' => false, 'error' => null, 'provider' => null];
    }

    /** @param array{sent: bool, error: string|null, provider: string} $result @return array{sent: bool, error: string|null, provider: string|null} */
    private function normalizeResult(array $result): array
    {
        return [
            'sent'     => $result['sent'],
            'error'    => $result['error'],
            'provider' => $result['provider'] ?? null,
        ];
    }
}

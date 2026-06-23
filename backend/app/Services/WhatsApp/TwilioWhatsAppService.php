<?php

namespace App\Services\WhatsApp;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TwilioWhatsAppService
{
    public function isConfigured(): bool
    {
        return filled(config('services.twilio.sid'))
            && filled(config('services.twilio.token'))
            && filled(config('services.twilio.whatsapp_from'));
    }

    /** @return array{sent: bool, error: string|null, provider: string} */
    public function sendText(string $phone, string $message): array
    {
        if (! $this->isConfigured()) {
            return ['sent' => false, 'error' => null, 'provider' => 'twilio'];
        }

        $sid   = config('services.twilio.sid');
        $token = config('services.twilio.token');
        $from  = config('services.twilio.whatsapp_from');
        $digits = $this->normalizeDigits($phone);

        if (! $digits) {
            return ['sent' => false, 'error' => 'Invalid phone number.', 'provider' => 'twilio'];
        }

        try {
            $response = Http::withBasicAuth($sid, $token)
                ->asForm()
                ->post('https://api.twilio.com/2010-04-01/Accounts/' . $sid . '/Messages.json', [
                    'From' => str_starts_with((string) $from, 'whatsapp:') ? $from : 'whatsapp:' . $from,
                    'To'   => 'whatsapp:+' . $digits,
                    'Body' => $message,
                ]);

            if ($response->successful()) {
                return ['sent' => true, 'error' => null, 'provider' => 'twilio'];
            }

            Log::warning('Twilio WhatsApp send failed', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);

            return ['sent' => false, 'error' => 'Twilio API error.', 'provider' => 'twilio'];
        } catch (\Throwable $e) {
            Log::warning('Twilio WhatsApp exception', ['message' => $e->getMessage()]);

            return ['sent' => false, 'error' => $e->getMessage(), 'provider' => 'twilio'];
        }
    }

    public function normalizeDigits(string $phone): ?string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';
        if ($digits === '') {
            return null;
        }

        if (strlen($digits) === 10) {
            $digits = '1' . $digits;
        }

        return $digits;
    }
}

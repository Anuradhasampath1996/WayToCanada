<?php

namespace App\Http\Controllers;

use App\Services\IntegrationSettingsService;
use App\Services\WhatsApp\MetaWhatsAppWebhookService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class WhatsAppWebhookController extends Controller
{
    public function __construct(
        private MetaWhatsAppWebhookService $webhookService,
        private IntegrationSettingsService $integrationSettings,
    ) {}

    public function verify(Request $request): Response|string
    {
        $this->integrationSettings->applyRuntimeConfig();

        $mode = (string) $request->query('hub_mode', $request->query('hub.mode', ''));
        $token = (string) $request->query('hub_verify_token', $request->query('hub.verify_token', ''));
        $challenge = (string) $request->query('hub_challenge', $request->query('hub.challenge', ''));

        $expected = (string) config('services.whatsapp_cloud.webhook_verify_token', '');

        if ($mode === 'subscribe' && $expected !== '' && hash_equals($expected, $token)) {
            return response($challenge, 200)->header('Content-Type', 'text/plain');
        }

        Log::warning('WhatsApp webhook verification failed', [
            'mode'  => $mode,
            'token' => $token !== '' ? '[present]' : '[missing]',
        ]);

        return response('Forbidden', 403);
    }

    public function handle(Request $request): Response
    {
        $this->integrationSettings->applyRuntimeConfig();

        $rawBody = $request->getContent();
        if (! $this->verifySignature($request, $rawBody)) {
            Log::warning('WhatsApp webhook rejected: invalid signature');

            return response('Invalid signature', 403);
        }

        /** @var array<string, mixed> $payload */
        $payload = json_decode($rawBody, true) ?: [];

        Log::info('WhatsApp webhook received', [
            'object'        => $payload['object'] ?? null,
            'entries'       => count($payload['entry'] ?? []),
            'has_messages'  => $this->payloadHasMessages($payload),
        ]);

        cache()->put('whatsapp_webhook_last_received_at', now()->toIso8601String(), now()->addDays(30));

        try {
            $this->webhookService->handle($payload);
        } catch (\Throwable $e) {
            Log::error('WhatsApp webhook processing failed', ['message' => $e->getMessage()]);
        }

        return response('EVENT_RECEIVED', 200);
    }

    /** @param array<string, mixed> $payload */
    private function payloadHasMessages(array $payload): bool
    {
        foreach ($payload['entry'] ?? [] as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                if (! empty($change['value']['messages'])) {
                    return true;
                }
            }
        }

        return false;
    }

    private function verifySignature(Request $request, string $rawBody): bool
    {
        $secret = (string) config('services.whatsapp_cloud.app_secret', '');
        if ($secret === '') {
            return true;
        }

        $header = (string) $request->header('X-Hub-Signature-256', '');
        if (! str_starts_with($header, 'sha256=')) {
            return false;
        }

        $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $secret);

        return hash_equals($expected, $header);
    }
}

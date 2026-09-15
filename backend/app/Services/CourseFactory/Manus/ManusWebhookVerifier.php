<?php

namespace App\Services\CourseFactory\Manus;

use Illuminate\Support\Facades\Cache;

class ManusWebhookVerifier
{
    public function __construct(private ManusV2Client $client) {}

    public function verify(string $rawBody, string $signature, string $timestamp, string $requestUrl): bool
    {
        $replayWindow = (int) config('course_factory.manus.webhook_replay_seconds', 300);
        if (abs(time() - (int) $timestamp) > $replayWindow) {
            return false;
        }

        $publicKey = Cache::remember('course_factory.manus.webhook_public_key', 3600, function () {
            return $this->client->webhookPublicKey();
        });

        if ($publicKey === '') {
            return false;
        }

        $payload = $requestUrl.'.'.$timestamp.'.'.$rawBody;
        $decoded = base64_decode($signature, true);
        if ($decoded === false) {
            return false;
        }

        $ok = openssl_verify($payload, $decoded, $publicKey, OPENSSL_ALGO_SHA256);

        return $ok === 1;
    }
}

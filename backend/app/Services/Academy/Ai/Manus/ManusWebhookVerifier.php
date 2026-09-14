<?php

namespace App\Services\Academy\Ai\Manus;

/**
 * Official Manus API v2 webhook security.
 * https://open.manus.ai/docs/v2/webhooks-security
 *
 * Signed content: {timestamp}.{full_url}.{sha256_hex(raw_body)}
 * Algorithm: RSA-SHA256 / PKCS#1 v1.5
 * Replay window: 5 minutes
 */
class ManusWebhookVerifier
{
    public function verify(string $publicKeyPem, string $url, string $rawBody, string $signatureB64, string $timestamp, ?int $now = null): bool
    {
        if ($publicKeyPem === '' || $signatureB64 === '' || $timestamp === '') {
            return false;
        }

        $now ??= time();
        if (abs($now - (int) $timestamp) > (int) config('academy_ai.manus.webhook_replay_seconds', 300)) {
            return false;
        }

        $signed = $timestamp.'.'.$url.'.'.hash('sha256', $rawBody);
        $signature = base64_decode($signatureB64, true);
        if ($signature === false) {
            return false;
        }

        $key = openssl_pkey_get_public($publicKeyPem);
        if ($key === false) {
            return false;
        }

        return openssl_verify($signed, $signature, $key, OPENSSL_ALGO_SHA256) === 1;
    }
}

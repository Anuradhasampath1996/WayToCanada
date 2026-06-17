<?php

namespace App\Services\Auth;

use Illuminate\Support\Str;

/**
 * Signed OAuth state for mobile / Flutter clients (return URL embedded in state).
 */
class MobileOAuthStateService
{
    private const TTL_SECONDS = 900;

    public function issue(string $returnTo, string $intent = 'client'): string
    {
        $payload = $this->encode([
            'return_to' => $returnTo,
            'intent'    => $intent,
            'exp'       => time() + self::TTL_SECONDS,
            'nonce'     => Str::random(16),
        ]);

        return 'mobile.' . $payload . '.' . $this->sign($payload);
    }

    /** @return array{return_to: string, intent: string}|null */
    public function consume(string $state): ?array
    {
        $state = trim($state);
        if (! str_starts_with($state, 'mobile.')) {
            return null;
        }

        $state = substr($state, 7);
        $dot = strrpos($state, '.');
        if ($dot === false) {
            return null;
        }

        $payload = substr($state, 0, $dot);
        $signature = substr($state, $dot + 1);

        if ($payload === '' || $signature === '' || ! hash_equals($this->sign($payload), $signature)) {
            return null;
        }

        $data = $this->decode($payload);
        if (! is_array($data) || ($data['exp'] ?? 0) < time()) {
            return null;
        }

        $returnTo = (string) ($data['return_to'] ?? '');
        if ($returnTo === '' || ! $this->isAllowedReturnTo($returnTo)) {
            return null;
        }

        $intent = (string) ($data['intent'] ?? 'client');
        if (! in_array($intent, ['client', 'consultant'], true)) {
            $intent = 'client';
        }

        return [
            'return_to' => $returnTo,
            'intent'    => $intent,
        ];
    }

    public function isAllowedReturnTo(string $url): bool
    {
        $parts = parse_url($url);
        if ($parts === false) {
            return false;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        if ($scheme === 'rcicmaster') {
            return true;
        }

        if (! in_array($scheme, ['http', 'https'], true)) {
            return false;
        }

        $host = strtolower((string) ($parts['host'] ?? ''));

        if (in_array($host, ['localhost', '127.0.0.1', '10.0.2.2'], true)) {
            return true;
        }

        return str_ends_with($host, '.rcicmaster.com') || $host === 'rcicmaster.com';
    }

    /** @param array<string, mixed> $data */
    private function encode(array $data): string
    {
        return rtrim(strtr(base64_encode(json_encode($data, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
    }

    /** @return array<string, mixed>|null */
    private function decode(string $payload): ?array
    {
        $json = base64_decode(strtr($payload, '-_', '+/'), true);
        if ($json === false) {
            return null;
        }

        $data = json_decode($json, true);

        return is_array($data) ? $data : null;
    }

    private function sign(string $payload): string
    {
        return hash_hmac('sha256', $payload, (string) config('app.key'));
    }
}

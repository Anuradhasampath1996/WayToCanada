<?php

namespace App\Services\Meetings;

use Illuminate\Support\Str;

/**
 * Signed OAuth state — survives without cache (array cache breaks cross-request OAuth).
 */
class MeetingOAuthStateService
{
    private const TTL_SECONDS = 900;

    public function issue(int $userId, string $provider): string
    {
        $payload = $this->encode([
            'user_id'  => $userId,
            'provider' => $provider,
            'exp'      => time() + self::TTL_SECONDS,
            'nonce'    => Str::random(16),
        ]);

        return $payload . '.' . $this->sign($payload);
    }

    public function consume(string $state): ?array
    {
        $state = trim($state);
        if ($state === '') {
            return null;
        }

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

        return [
            'user_id'  => (int) ($data['user_id'] ?? 0),
            'provider' => (string) ($data['provider'] ?? ''),
        ];
    }

    /** @param array<string, mixed> $data */
    private function encode(array $data): string
    {
        return rtrim(strtr(base64_encode(json_encode($data, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
    }

    /** @return array<string, mixed>|null */
    private function decode(string $payload): ?array
    {
        $padding = (4 - strlen($payload) % 4) % 4;
        $json = base64_decode(strtr($payload, '-_', '+/') . str_repeat('=', $padding), true);
        if ($json === false) {
            return null;
        }

        $data = json_decode($json, true);

        return is_array($data) ? $data : null;
    }

    private function sign(string $payload): string
    {
        return rtrim(strtr(base64_encode(hash_hmac('sha256', $payload, $this->signingKey(), true)), '+/', '-_'), '=');
    }

    private function signingKey(): string
    {
        $key = (string) config('app.key');

        if (str_starts_with($key, 'base64:')) {
            $decoded = base64_decode(substr($key, 7), true);

            return $decoded !== false ? $decoded : $key;
        }

        return $key;
    }
}

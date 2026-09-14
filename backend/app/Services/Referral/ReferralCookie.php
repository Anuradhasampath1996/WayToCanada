<?php

namespace App\Services\Referral;

use Illuminate\Support\Facades\Crypt;
use Throwable;

class ReferralCookie
{
    /**
     * @return array{code: string, clicked_at: string, ip_hash: ?string}
     */
    public function payload(string $code, ?string $ipHash = null): array
    {
        return [
            'code' => strtoupper(trim($code)),
            'clicked_at' => now()->toIso8601String(),
            'ip_hash' => $ipHash,
        ];
    }

    /**
     * @param  array{code: string, clicked_at?: string, ip_hash?: ?string}  $payload
     */
    public function encode(array $payload): string
    {
        return Crypt::encryptString(json_encode($payload, JSON_THROW_ON_ERROR));
    }

    /**
     * @return array{code: string, clicked_at: ?string, ip_hash: ?string}|null
     */
    public function decode(?string $value): ?array
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            $decoded = json_decode(Crypt::decryptString($value), true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            return null;
        }

        if (! is_array($decoded) || empty($decoded['code']) || ! is_string($decoded['code'])) {
            return null;
        }

        return [
            'code' => strtoupper(trim($decoded['code'])),
            'clicked_at' => isset($decoded['clicked_at']) ? (string) $decoded['clicked_at'] : null,
            'ip_hash' => isset($decoded['ip_hash']) ? (string) $decoded['ip_hash'] : null,
        ];
    }
}

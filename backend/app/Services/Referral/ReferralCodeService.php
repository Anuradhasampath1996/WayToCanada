<?php

namespace App\Services\Referral;

use App\Models\ConsultantReferralCode;
use App\Models\User;
use Illuminate\Support\Str;

class ReferralCodeService
{
    private const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

    public function ensureForUser(User $user): ConsultantReferralCode
    {
        $existing = ConsultantReferralCode::query()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->orderBy('id')
            ->first();

        if ($existing) {
            return $existing;
        }

        return ConsultantReferralCode::query()->create([
            'user_id' => $user->id,
            'code' => $this->uniqueCode(),
            'is_active' => true,
        ]);
    }

    public function findActiveByCode(string $code): ?ConsultantReferralCode
    {
        $normalized = strtoupper(trim($code));
        if ($normalized === '') {
            return null;
        }

        return ConsultantReferralCode::query()
            ->where('code', $normalized)
            ->where('is_active', true)
            ->first();
    }

    public function findByCode(string $code): ?ConsultantReferralCode
    {
        $normalized = strtoupper(trim($code));
        if ($normalized === '') {
            return null;
        }

        return ConsultantReferralCode::query()->where('code', $normalized)->first();
    }

    public function rotate(User $user, ?int $actorId = null): ConsultantReferralCode
    {
        return ConsultantReferralCode::query()->create([
            'user_id' => $user->id,
            'code' => $this->uniqueCode(),
            'is_active' => true,
        ]);
    }

    public function uniqueCode(): string
    {
        $length = max(8, min(12, (int) config('referral.code_length', 8)));

        do {
            $code = $this->randomCode($length);
        } while (ConsultantReferralCode::query()->where('code', $code)->exists());

        return $code;
    }

    private function randomCode(int $length): string
    {
        $alphabet = self::ALPHABET;
        $max = strlen($alphabet) - 1;
        $out = '';
        for ($i = 0; $i < $length; $i++) {
            $out .= $alphabet[random_int(0, $max)];
        }

        return $out;
    }

    public function hashIp(?string $ip): ?string
    {
        if (! $ip) {
            return null;
        }

        return hash('sha256', $ip.'|'.(string) config('app.key'));
    }

    public function hashUserAgent(?string $userAgent): ?string
    {
        if (! $userAgent) {
            return null;
        }

        return hash('sha256', $userAgent.'|'.(string) config('app.key'));
    }

    public function firstName(User $user): string
    {
        $name = trim((string) $user->name);

        return $name === '' ? 'Consultant' : (string) Str::of($name)->before(' ')->trim();
    }
}

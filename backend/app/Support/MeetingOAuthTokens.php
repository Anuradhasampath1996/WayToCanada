<?php

namespace App\Support;

use Illuminate\Support\Facades\Crypt;

class MeetingOAuthTokens
{
    public static function encrypt(?string $value): ?string
    {
        return $value ? Crypt::encryptString($value) : null;
    }

    public static function decrypt(?string $value): ?string
    {
        if (! $value) {
            return null;
        }
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return null;
        }
    }
}

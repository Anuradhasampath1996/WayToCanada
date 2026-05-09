<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class PaymentGatewaySetting extends Model
{
    protected $table = 'payment_gateway_settings';

    protected $fillable = [
        'gateway',
        'mode',
        'is_active',
        'publishable_key',
        'secret_key',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Encrypt a key before storing. Pass null to clear.
     */
    public static function encryptKey(?string $value): ?string
    {
        return $value ? Crypt::encryptString($value) : null;
    }

    /**
     * Safely decrypt a key. Returns null on failure.
     */
    public static function decryptKey(?string $value): ?string
    {
        if (!$value) return null;
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Return a masked version: show only last 4 chars.
     */
    public static function maskKey(?string $decrypted): ?string
    {
        if (!$decrypted) return null;
        $len = strlen($decrypted);
        if ($len <= 4) return str_repeat('*', $len);
        return str_repeat('*', $len - 4) . substr($decrypted, -4);
    }
}

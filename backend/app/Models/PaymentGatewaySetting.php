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
        'webhook_id',
        'last_webhook_at',
        'last_webhook_type',
        'last_webhook_account',
        'stripe_test_clock_id',
        'use_test_clock',
    ];

    protected $casts = [
        'is_active'       => 'boolean',
        'use_test_clock'  => 'boolean',
        'last_webhook_at' => 'datetime',
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
        if (! $decrypted) {
            return null;
        }

        $last4 = substr($decrypted, -4);

        if (preg_match('/^(pk|sk)_(test|live)_/', $decrypted, $m)) {
            return $m[0] . '••••' . $last4;
        }

        if (str_starts_with($decrypted, 'whsec_')) {
            return 'whsec_••••' . $last4;
        }

        return '••••' . $last4;
    }
}

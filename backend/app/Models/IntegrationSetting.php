<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class IntegrationSetting extends Model
{
    protected $connection = 'cws';

    protected $table = 'integration_settings';

    protected $fillable = [
        'group_key',
        'payload',
        'updated_by',
    ];

    public function updatedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public static function encryptPayload(array $values): string
    {
        return Crypt::encryptString(json_encode($values));
    }

    /** @return array<string, mixed> */
    public static function decryptPayload(?string $payload): array
    {
        if (! $payload) {
            return [];
        }

        try {
            $decoded = json_decode(Crypt::decryptString($payload), true);

            return is_array($decoded) ? $decoded : [];
        } catch (\Throwable) {
            return [];
        }
    }

    public static function maskSecret(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        $len = strlen($value);
        if ($len <= 4) {
            return '••••';
        }

        return '••••' . substr($value, -4);
    }
}

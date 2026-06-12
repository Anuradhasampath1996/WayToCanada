<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserNotificationPreference extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'user_id',
        'in_app_enabled',
        'email_enabled',
        'whatsapp_enabled',
        'whatsapp_phone',
        'whatsapp_verified',
        'category_preferences',
    ];

    protected function casts(): array
    {
        return [
            'in_app_enabled'       => 'boolean',
            'email_enabled'        => 'boolean',
            'whatsapp_enabled'     => 'boolean',
            'whatsapp_verified'    => 'boolean',
            'category_preferences' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

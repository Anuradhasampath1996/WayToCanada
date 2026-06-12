<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminBroadcast extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'admin_user_id',
        'title',
        'body',
        'action_url',
        'channels',
        'target_type',
        'target_user_ids',
        'scheduled_at',
        'sent_at',
        'recipient_count',
    ];

    protected function casts(): array
    {
        return [
            'channels'         => 'array',
            'target_user_ids'  => 'array',
            'scheduled_at'     => 'datetime',
            'sent_at'          => 'datetime',
        ];
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }
}

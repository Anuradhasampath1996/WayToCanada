<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantClientAiChatMessage extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'client_profile_id',
        'consultant_id',
        'role',
        'content',
        'openai_used',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'openai_used' => 'boolean',
            'metadata'    => 'array',
        ];
    }

    public function clientProfile(): BelongsTo
    {
        return $this->belongsTo(ClientProfile::class);
    }

    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consultant_id');
    }
}

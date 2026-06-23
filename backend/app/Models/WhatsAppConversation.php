<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WhatsAppConversation extends Model
{
    protected $connection = 'cws';

    protected $table = 'whatsapp_conversations';

    protected $fillable = [
        'wa_id',
        'contact_name',
        'user_id',
        'last_message_at',
        'last_message_preview',
        'unread_count',
        'session_expires_at',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at'    => 'datetime',
            'session_expires_at' => 'datetime',
            'unread_count'       => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(WhatsAppMessage::class);
    }

    public function hasOpenSession(): bool
    {
        return $this->session_expires_at !== null && $this->session_expires_at->isFuture();
    }
}

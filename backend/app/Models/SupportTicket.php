<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTicket extends Model
{
    protected $connection = 'cws';

    public const STATUS_OPEN = 'open';

    public const STATUS_CLOSED = 'closed';

    public const CATEGORY_BUG = 'bug';

    public const CATEGORY_WRONG_FLOW = 'wrong_flow';

    public const CATEGORY_FEATURE = 'feature_request';

    public const CATEGORY_OTHER = 'other';

    /** @var list<string> */
    public const CATEGORIES = [
        self::CATEGORY_BUG,
        self::CATEGORY_WRONG_FLOW,
        self::CATEGORY_FEATURE,
        self::CATEGORY_OTHER,
    ];

    protected $fillable = [
        'user_id',
        'category',
        'subject',
        'body',
        'status',
        'last_reply_at',
        'closed_at',
        'closed_by',
    ];

    protected function casts(): array
    {
        return [
            'last_reply_at' => 'datetime',
            'closed_at'     => 'datetime',
        ];
    }

    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function closedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportTicketMessage::class);
    }

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_OPEN;
    }
}

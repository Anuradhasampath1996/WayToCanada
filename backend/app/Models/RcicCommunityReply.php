<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RcicCommunityReply extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'post_id',
        'user_id',
        'body',
        'is_hidden',
        'hidden_at',
        'hidden_by',
    ];

    protected function casts(): array
    {
        return [
            'is_hidden' => 'boolean',
            'hidden_at' => 'datetime',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(RcicCommunityPost::class, 'post_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function scopeVisible($query)
    {
        return $query->where('is_hidden', false);
    }
}

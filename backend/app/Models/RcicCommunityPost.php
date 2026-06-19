<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RcicCommunityPost extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'user_id',
        'title',
        'body',
        'attachment_path',
        'attachment_name',
        'attachment_mime',
        'attachment_size',
        'reactions_count',
        'replies_count',
        'is_hidden',
        'hidden_at',
        'hidden_by',
    ];

    protected function casts(): array
    {
        return [
            'is_hidden'       => 'boolean',
            'hidden_at'       => 'datetime',
            'reactions_count' => 'integer',
            'replies_count'   => 'integer',
            'attachment_size' => 'integer',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(RcicCommunityReply::class, 'post_id');
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(RcicCommunityReaction::class, 'post_id');
    }

    public function scopeVisible($query)
    {
        return $query->where('is_hidden', false);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RcicCommunityReaction extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'post_id',
        'user_id',
        'reaction',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(RcicCommunityPost::class, 'post_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

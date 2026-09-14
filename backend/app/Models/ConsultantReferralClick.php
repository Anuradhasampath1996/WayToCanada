<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantReferralClick extends Model
{
    protected $connection = 'cws';

    protected $fillable = ['code', 'referrer_user_id', 'ip_hash', 'user_agent_hash'];

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referrer_user_id');
    }
}

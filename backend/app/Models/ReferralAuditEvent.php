<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReferralAuditEvent extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'actor_user_id',
        'action',
        'subject_type',
        'subject_id',
        'before',
        'after',
        'ip',
    ];

    protected function casts(): array
    {
        return [
            'before' => 'array',
            'after' => 'array',
        ];
    }
}

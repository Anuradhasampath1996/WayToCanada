<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeamAuditEvent extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'actor_user_id',
        'workspace_id',
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

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(ConsultantWorkspace::class, 'workspace_id');
    }
}

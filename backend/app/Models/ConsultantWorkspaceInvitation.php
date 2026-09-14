<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantWorkspaceInvitation extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'workspace_id',
        'email',
        'name',
        'job_title',
        'preset_key',
        'access_scope',
        'allowed_case_file_ids',
        'permissions_snapshot',
        'token_hash',
        'expires_at',
        'accepted_at',
        'revoked_at',
        'invited_by',
        'accepted_user_id',
    ];

    protected function casts(): array
    {
        return [
            'allowed_case_file_ids' => 'array',
            'permissions_snapshot' => 'array',
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(ConsultantWorkspace::class, 'workspace_id');
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function acceptedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_user_id');
    }

    public function isPending(): bool
    {
        return $this->accepted_at === null
            && $this->revoked_at === null
            && $this->expires_at?->isFuture();
    }
}

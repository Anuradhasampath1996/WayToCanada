<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConsultantWorkspace extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'owner_user_id',
        'name',
        'seat_limit_override',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(ConsultantWorkspaceMember::class, 'workspace_id');
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(ConsultantWorkspaceInvitation::class, 'workspace_id');
    }

    public function auditEvents(): HasMany
    {
        return $this->hasMany(TeamAuditEvent::class, 'workspace_id');
    }
}

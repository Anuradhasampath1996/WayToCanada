<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ConsultantWorkspaceMember extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_SUSPENDED = 'suspended';
    public const STATUS_DEACTIVATED = 'deactivated';
    public const STATUS_REMOVED = 'removed';

    public const SCOPE_ALL = 'all_cases';
    public const SCOPE_ASSIGNED = 'assigned_cases';
    public const SCOPE_SELECTED = 'selected_cases';

    protected $connection = 'cws';

    protected $fillable = [
        'workspace_id',
        'user_id',
        'invited_by',
        'job_title',
        'preset_key',
        'access_scope',
        'allowed_case_file_ids',
        'allowed_client_profile_ids',
        'status',
        'last_login_at',
        'deactivated_at',
    ];

    protected function casts(): array
    {
        return [
            'allowed_case_file_ids' => 'array',
            'allowed_client_profile_ids' => 'array',
            'last_login_at' => 'datetime',
            'deactivated_at' => 'datetime',
        ];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(ConsultantWorkspace::class, 'workspace_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function permissionSet(): HasOne
    {
        return $this->hasOne(ConsultantWorkspaceMemberPermission::class, 'member_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(CaseTeamAssignment::class, 'member_id');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /** @return list<int> */
    public function allowedCaseFileIds(): array
    {
        return array_values(array_unique(array_map('intval', $this->allowed_case_file_ids ?? [])));
    }

    /** @return list<int> */
    public function allowedClientProfileIds(): array
    {
        return array_values(array_unique(array_map('intval', $this->allowed_client_profile_ids ?? [])));
    }

    /** @return array<string, bool> */
    public function permissionMap(): array
    {
        $raw = $this->permissionSet?->permissions ?? [];

        return is_array($raw) ? $raw : [];
    }
}

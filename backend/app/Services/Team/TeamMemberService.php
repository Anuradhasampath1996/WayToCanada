<?php

namespace App\Services\Team;

use App\Models\ConsultantWorkspace;
use App\Models\ConsultantWorkspaceMember;
use App\Models\ConsultantWorkspaceMemberPermission;
use App\Models\User;

class TeamMemberService
{
    public function __construct(
        private TeamPermissionCatalog $catalog,
        private TeamAuditService $audit,
        private TeamNotificationService $notify,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(ConsultantWorkspaceMember $member, User $actor, array $data): ConsultantWorkspaceMember
    {
        $before = $this->snapshot($member);
        $member->fill(array_filter([
            'job_title' => $data['job_title'] ?? $member->job_title,
            'preset_key' => array_key_exists('preset_key', $data) ? $data['preset_key'] : $member->preset_key,
        ], fn ($v) => $v !== null));
        $member->save();

        $this->audit->record(
            'member_updated',
            'member',
            $member->id,
            $member->workspace_id,
            $before,
            $this->snapshot($member->fresh()),
            $actor->id,
        );

        return $member->fresh(['user', 'permissionSet']);
    }

    /**
     * @param  array<string, mixed>  $permissions
     */
    public function updatePermissions(ConsultantWorkspaceMember $member, User $actor, array $permissions): ConsultantWorkspaceMember
    {
        $sanitized = $this->catalog->sanitize($permissions);
        $before = $member->permissionMap();
        ConsultantWorkspaceMemberPermission::query()->updateOrCreate(
            ['member_id' => $member->id],
            ['permissions' => $sanitized],
        );
        $this->audit->record(
            'permissions_updated',
            'member',
            $member->id,
            $member->workspace_id,
            $before,
            $sanitized,
            $actor->id,
        );
        $this->notify->accessUpdated($member->fresh('user'));

        return $member->fresh(['user', 'permissionSet']);
    }

    /**
     * @param  list<int>  $allowedCaseFileIds
     */
    public function updateScope(
        ConsultantWorkspaceMember $member,
        User $actor,
        string $scope,
        array $allowedCaseFileIds = [],
    ): ConsultantWorkspaceMember {
        $before = [
            'access_scope' => $member->access_scope,
            'allowed_case_file_ids' => $member->allowedCaseFileIds(),
        ];
        $member->update([
            'access_scope' => $scope,
            'allowed_case_file_ids' => array_values(array_unique(array_map('intval', $allowedCaseFileIds))),
        ]);
        $this->audit->record(
            'scope_updated',
            'member',
            $member->id,
            $member->workspace_id,
            $before,
            [
                'access_scope' => $member->access_scope,
                'allowed_case_file_ids' => $member->allowedCaseFileIds(),
            ],
            $actor->id,
        );
        $this->notify->accessUpdated($member->fresh('user'));

        return $member->fresh(['user', 'permissionSet']);
    }

    public function deactivate(ConsultantWorkspaceMember $member, User $actor): ConsultantWorkspaceMember
    {
        $member->update([
            'status' => ConsultantWorkspaceMember::STATUS_DEACTIVATED,
            'deactivated_at' => now(),
        ]);
        $member->user?->tokens()->delete();
        $this->audit->record('member_deactivated', 'member', $member->id, $member->workspace_id, null, ['status' => $member->status], $actor->id);
        $this->notify->deactivated($member->fresh('user'));

        return $member->fresh(['user', 'permissionSet']);
    }

    public function reactivate(ConsultantWorkspaceMember $member, User $actor): ConsultantWorkspaceMember
    {
        $member->update([
            'status' => ConsultantWorkspaceMember::STATUS_ACTIVE,
            'deactivated_at' => null,
        ]);
        $this->audit->record('member_reactivated', 'member', $member->id, $member->workspace_id, null, ['status' => $member->status], $actor->id);

        return $member->fresh(['user', 'permissionSet']);
    }

    public function revokeSessions(ConsultantWorkspaceMember $member, User $actor): void
    {
        $member->user?->tokens()->delete();
        $this->audit->record('sessions_revoked', 'member', $member->id, $member->workspace_id, null, null, $actor->id);
    }

    public function remove(ConsultantWorkspaceMember $member, User $actor): ConsultantWorkspaceMember
    {
        $member->update([
            'status' => ConsultantWorkspaceMember::STATUS_REMOVED,
            'deactivated_at' => $member->deactivated_at ?? now(),
        ]);
        $member->user?->tokens()->delete();
        $this->audit->record('member_removed', 'member', $member->id, $member->workspace_id, null, ['status' => $member->status], $actor->id);

        return $member->fresh(['user', 'permissionSet']);
    }

    /** @return array<string, mixed> */
    private function snapshot(ConsultantWorkspaceMember $member): array
    {
        return [
            'job_title' => $member->job_title,
            'preset_key' => $member->preset_key,
            'access_scope' => $member->access_scope,
            'status' => $member->status,
            'permissions' => $member->permissionMap(),
        ];
    }
}

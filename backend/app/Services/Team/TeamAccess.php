<?php

namespace App\Services\Team;

use App\Models\CaseFile;
use App\Models\CaseTeamAssignment;
use App\Models\ClientProfile;
use App\Models\ConsultantSubscription;
use App\Models\ConsultantWorkspace;
use App\Models\ConsultantWorkspaceMember;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class TeamAccess
{
    public function __construct(
        private TeamPermissionCatalog $catalog,
        private TeamWorkspaceService $workspaces,
    ) {}

    public function isWorkspaceOwner(User $user, ?int $ownerUserId = null): bool
    {
        if (! $user->hasRole('rcic')) {
            return false;
        }

        return $ownerUserId === null || (int) $user->id === (int) $ownerUserId;
    }

    public function activeMembership(User $user): ?ConsultantWorkspaceMember
    {
        if (! $user->hasRole('staff')) {
            return null;
        }

        return ConsultantWorkspaceMember::query()
            ->with(['workspace.owner', 'permissionSet'])
            ->where('user_id', $user->id)
            ->where('status', ConsultantWorkspaceMember::STATUS_ACTIVE)
            ->first();
    }

    public function membershipForWorkspace(User $user, ConsultantWorkspace $workspace): ?ConsultantWorkspaceMember
    {
        return ConsultantWorkspaceMember::query()
            ->with('permissionSet')
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $user->id)
            ->first();
    }

    public function actingOwnerId(User $user): ?int
    {
        if ($this->isWorkspaceOwner($user)) {
            return (int) $user->id;
        }

        return $this->activeMembership($user)?->workspace?->owner_user_id;
    }

    public function ownerUserId(User $user, ClientProfile $profile): int
    {
        $this->authorize($user, $profile);

        return (int) $profile->consultant_id;
    }

    /** @return array<string, mixed>|null */
    public function sessionContext(User $user): ?array
    {
        if ($this->isWorkspaceOwner($user)) {
            $workspace = $this->workspaces->ensureForOwner($user);

            return [
                'actor_type' => 'owner',
                'workspace' => [
                    'id' => $workspace->id,
                    'owner_name' => $user->name,
                    'firm_name' => $workspace->name,
                    'owner_user_id' => $user->id,
                ],
                'preset_key' => null,
                'access_scope' => ConsultantWorkspaceMember::SCOPE_ALL,
                'permissions' => collect($this->catalog->assignable())
                    ->mapWithKeys(fn (string $key) => [$key => true])
                    ->all(),
                'owner_only' => $this->catalog->ownerOnly(),
            ];
        }

        if (! $user->hasRole('staff')) {
            return null;
        }

        $member = $this->activeMembership($user);
        if (! $member) {
            return [
                'actor_type' => 'staff',
                'workspace' => null,
                'preset_key' => null,
                'access_scope' => null,
                'permissions' => [],
                'owner_only' => $this->catalog->ownerOnly(),
            ];
        }

        $owner = $member->workspace?->owner;

        return [
            'actor_type' => 'staff',
            'workspace' => [
                'id' => $member->workspace_id,
                'owner_name' => $owner?->name,
                'firm_name' => $member->workspace?->name,
                'owner_user_id' => $member->workspace?->owner_user_id,
            ],
            'preset_key' => $member->preset_key,
            'job_title' => $member->job_title,
            'access_scope' => $member->access_scope,
            'permissions' => $member->permissionMap(),
            'owner_only' => $this->catalog->ownerOnly(),
            'member_id' => $member->id,
        ];
    }

    public function can(User $user, string $permission, ?ClientProfile $profile = null, ?CaseFile $case = null): bool
    {
        if ($this->catalog->isOwnerOnly($permission)) {
            if ($profile) {
                return $this->isWorkspaceOwner($user, (int) $profile->consultant_id);
            }

            return $this->isWorkspaceOwner($user);
        }

        if ($this->isWorkspaceOwner($user)) {
            if ($profile && (int) $profile->consultant_id !== (int) $user->id) {
                return false;
            }

            return true;
        }

        $member = $this->activeMembership($user);
        if (! $member || ! $member->workspace) {
            return false;
        }

        if (! $this->ownerEntitlementAllowsStaff($member->workspace)) {
            return false;
        }

        if (! $this->memberHasPermission($member, $permission)) {
            return false;
        }

        if ($profile) {
            return $this->profileInScope($member, $profile);
        }

        if ($case) {
            return $this->caseInScope($member, $case);
        }

        return true;
    }

    public function authorize(User $user, ClientProfile $profile, string $permission = 'clients.view'): void
    {
        if ($this->isWorkspaceOwner($user, (int) $profile->consultant_id)) {
            return;
        }

        $member = $this->activeMembership($user);
        if (! $member?->workspace || (int) $member->workspace->owner_user_id !== (int) $profile->consultant_id) {
            abort(404, 'Not found.');
        }

        if (! $this->ownerEntitlementAllowsStaff($member->workspace)) {
            abort(403, 'This workspace is locked because the practice subscription is inactive.');
        }

        if ($this->catalog->isOwnerOnly($permission) || ! $this->memberHasPermission($member, $permission)) {
            abort(403, 'You do not have permission to perform this action.');
        }

        if (! $this->profileInScope($member, $profile)) {
            abort(404, 'Not found.');
        }
    }

    public function requireOwner(User $user, ClientProfile $profile): void
    {
        if ($this->isWorkspaceOwner($user, (int) $profile->consultant_id)) {
            return;
        }

        $member = $this->activeMembership($user);
        if ($member?->workspace && (int) $member->workspace->owner_user_id === (int) $profile->consultant_id) {
            abort(403, 'This action is reserved for the licensed consultant.');
        }

        abort(404, 'Not found.');
    }

    public function authorizeOwnerWorkspace(User $user): ConsultantWorkspace
    {
        if (! $this->isWorkspaceOwner($user)) {
            abort(403, 'Team management is reserved for the licensed consultant.');
        }

        return $this->workspaces->ensureForOwner($user);
    }

    public function authorizeModule(User $user, string $permission): void
    {
        if ($this->isWorkspaceOwner($user)) {
            return;
        }

        if (! $this->can($user, $permission)) {
            abort(403, 'You do not have permission to access this module.');
        }
    }

    public function assertStaffMayUseWorkspace(User $user): void
    {
        if ($this->isWorkspaceOwner($user)) {
            return;
        }

        $member = $this->activeMembership($user);
        if (! $member?->workspace) {
            abort(403, 'Your team access is no longer active.');
        }

        if (! $this->ownerEntitlementAllowsStaff($member->workspace)) {
            abort(403, 'This workspace is locked because the practice subscription is inactive.');
        }
    }

    public function visibleClientQuery(User $user): Builder
    {
        if ($this->isWorkspaceOwner($user)) {
            return ClientProfile::query()->forConsultant((int) $user->id);
        }

        $member = $this->activeMembership($user);
        if (! $member?->workspace || ! $this->ownerEntitlementAllowsStaff($member->workspace)) {
            return ClientProfile::query()->whereRaw('1 = 0');
        }

        $query = ClientProfile::query()->forConsultant((int) $member->workspace->owner_user_id);
        $caseIds = $this->visibleCaseFileIds($member);

        if ($caseIds === null) {
            return $query;
        }

        if ($caseIds === []) {
            $profileIds = $member->allowedClientProfileIds();
            if ($profileIds === []) {
                return $query->whereRaw('1 = 0');
            }

            return $query->whereIn('id', $profileIds);
        }

        $profileIds = $member->allowedClientProfileIds();

        return $query->where(function (Builder $inner) use ($caseIds, $profileIds) {
            $inner->whereIn('active_case_file_id', $caseIds)
                ->orWhereHas('caseFiles', fn (Builder $cases) => $cases->whereIn('id', $caseIds));
            if ($profileIds !== []) {
                $inner->orWhereIn('id', $profileIds);
            }
        });
    }

    public function ownerEntitlementAllowsStaff(ConsultantWorkspace $workspace): bool
    {
        $sub = ConsultantSubscription::query()
            ->where('user_id', $workspace->owner_user_id)
            ->whereIn('status', ['trial', 'active', 'past_due'])
            ->latest()
            ->first();

        if (! $sub) {
            return false;
        }

        if ($sub->status === 'trial' && $sub->trial_ends_at && $sub->trial_ends_at->isPast()) {
            return false;
        }

        if ($sub->status === 'active' && $sub->ends_at && $sub->ends_at->isPast()) {
            return false;
        }

        return $sub->isCurrentlyActive();
    }

    public function entitlementUser(User $user): User
    {
        if ($this->isWorkspaceOwner($user) || ! $user->hasRole('staff')) {
            return $user;
        }

        $owner = $this->activeMembership($user)?->workspace?->owner;

        return $owner ?? $user;
    }

    private function memberHasPermission(ConsultantWorkspaceMember $member, string $permission): bool
    {
        if (! $this->catalog->isAssignable($permission) || $this->catalog->isOwnerOnly($permission)) {
            return false;
        }

        return (bool) ($member->permissionMap()[$permission] ?? false);
    }

    public function profileInScope(ConsultantWorkspaceMember $member, ClientProfile $profile): bool
    {
        if ((int) $profile->consultant_id !== (int) $member->workspace?->owner_user_id) {
            return false;
        }

        if ($member->access_scope === ConsultantWorkspaceMember::SCOPE_ALL) {
            return true;
        }

        if (in_array((int) $profile->id, $member->allowedClientProfileIds(), true)) {
            return true;
        }

        $visible = $this->visibleCaseFileIds($member) ?? [];
        if ($visible === []) {
            return false;
        }

        if ($profile->active_case_file_id && in_array((int) $profile->active_case_file_id, $visible, true)) {
            return true;
        }

        return $profile->caseFiles()->whereIn('id', $visible)->exists();
    }

    public function caseInScope(ConsultantWorkspaceMember $member, CaseFile $case): bool
    {
        if ((int) $case->consultant_id !== (int) $member->workspace?->owner_user_id) {
            return false;
        }

        if ($member->access_scope === ConsultantWorkspaceMember::SCOPE_ALL) {
            return true;
        }

        $visible = $this->visibleCaseFileIds($member) ?? [];

        return in_array((int) $case->id, $visible, true);
    }

    /** @return list<int>|null null means all cases */
    public function visibleCaseFileIds(ConsultantWorkspaceMember $member): ?array
    {
        if ($member->access_scope === ConsultantWorkspaceMember::SCOPE_ALL) {
            return null;
        }

        $assigned = CaseTeamAssignment::query()
            ->where('member_id', $member->id)
            ->pluck('case_file_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if ($member->access_scope === ConsultantWorkspaceMember::SCOPE_ASSIGNED) {
            return array_values(array_unique($assigned));
        }

        return array_values(array_unique(array_merge($member->allowedCaseFileIds(), $assigned)));
    }
}

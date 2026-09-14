<?php

namespace App\Services\Team;

use App\Mail\TeamInvitationMail;
use App\Models\ConsultantWorkspace;
use App\Models\ConsultantWorkspaceInvitation;
use App\Models\ConsultantWorkspaceMember;
use App\Models\ConsultantWorkspaceMemberPermission;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TeamInvitationService
{
    public function __construct(
        private TeamPermissionCatalog $catalog,
        private TeamAuditService $audit,
        private TeamNotificationService $notify,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array{invitation: ConsultantWorkspaceInvitation, token: string}
     */
    public function invite(ConsultantWorkspace $workspace, User $owner, array $data): array
    {
        $email = strtolower(trim((string) $data['email']));
        $this->assertEmailAvailable($email);

        $pending = ConsultantWorkspaceInvitation::query()
            ->where('workspace_id', $workspace->id)
            ->whereRaw('LOWER(email) = ?', [$email])
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->exists();

        if ($pending) {
            throw ValidationException::withMessages([
                'email' => ['An active invitation already exists for this email.'],
            ]);
        }

        $permissions = $this->catalog->sanitize($data['permissions'] ?? $this->catalog->fromPreset((string) ($data['preset_key'] ?? '')));
        $token = $this->rawToken();
        $invitation = ConsultantWorkspaceInvitation::query()->create([
            'workspace_id' => $workspace->id,
            'email' => $email,
            'name' => $data['name'],
            'job_title' => $data['job_title'] ?? null,
            'preset_key' => $data['preset_key'] ?? null,
            'access_scope' => $data['access_scope'] ?? ConsultantWorkspaceMember::SCOPE_ASSIGNED,
            'allowed_case_file_ids' => array_values(array_map('intval', $data['allowed_case_file_ids'] ?? [])),
            'permissions_snapshot' => $permissions,
            'token_hash' => $this->hashToken($token),
            'expires_at' => now()->addDays((int) config('team.invite_days', 7)),
            'invited_by' => $owner->id,
        ]);

        $this->sendMail($invitation, $token, $workspace, $owner);
        $this->audit->record(
            'invite_sent',
            'invitation',
            $invitation->id,
            $workspace->id,
            null,
            ['email' => $email, 'preset_key' => $invitation->preset_key, 'access_scope' => $invitation->access_scope],
            $owner->id,
        );

        return ['invitation' => $invitation, 'token' => $token];
    }

    /**
     * @return array{invitation: ConsultantWorkspaceInvitation, token: string}
     */
    public function resend(ConsultantWorkspaceInvitation $invitation, User $owner): array
    {
        if ($invitation->accepted_at || $invitation->revoked_at) {
            throw ValidationException::withMessages([
                'invitation' => ['This invitation can no longer be resent.'],
            ]);
        }

        $this->assertEmailAvailable($invitation->email, $invitation->id);

        $token = $this->rawToken();
        $invitation->update([
            'token_hash' => $this->hashToken($token),
            'expires_at' => now()->addDays((int) config('team.invite_days', 7)),
        ]);

        $this->sendMail($invitation->fresh(), $token, $invitation->workspace, $owner);
        $this->audit->record(
            'invite_resent',
            'invitation',
            $invitation->id,
            $invitation->workspace_id,
            null,
            ['email' => $invitation->email],
            $owner->id,
        );

        return ['invitation' => $invitation->fresh(), 'token' => $token];
    }

    public function revoke(ConsultantWorkspaceInvitation $invitation, User $owner): void
    {
        if ($invitation->accepted_at) {
            throw ValidationException::withMessages([
                'invitation' => ['An accepted invitation cannot be cancelled.'],
            ]);
        }

        $invitation->update(['revoked_at' => now()]);
        $this->audit->record(
            'invite_revoked',
            'invitation',
            $invitation->id,
            $invitation->workspace_id,
            null,
            ['email' => $invitation->email],
            $owner->id,
        );
    }

    public function findByToken(string $token): ?ConsultantWorkspaceInvitation
    {
        if ($token === '') {
            return null;
        }

        return ConsultantWorkspaceInvitation::query()
            ->with(['workspace.owner'])
            ->where('token_hash', $this->hashToken($token))
            ->first();
    }

    public function assertUsable(ConsultantWorkspaceInvitation $invitation): void
    {
        if ($invitation->revoked_at) {
            abort(410, 'This invitation has been cancelled.');
        }
        if ($invitation->accepted_at) {
            abort(410, 'This invitation has already been used.');
        }
        if ($invitation->expires_at?->isPast()) {
            abort(410, 'This invitation has expired.');
        }
    }

    /**
     * @return array{user: User, token: string}
     */
    public function accept(ConsultantWorkspaceInvitation $invitation, array $data): array
    {
        $this->assertUsable($invitation);
        $this->assertEmailAvailable($invitation->email, $invitation->id);

        $user = null;
        $plainToken = '';

        DB::connection('cws')->transaction(function () use ($invitation, $data, &$user, &$plainToken) {
            $user = User::query()->create([
                'name' => $data['name'] ?? $invitation->name,
                'email' => $invitation->email,
                'password' => $data['password'],
                'is_verified' => true,
                'email_verified_at' => now(),
                'locale' => 'en',
            ]);
            $user->assignRole('staff');

            $member = ConsultantWorkspaceMember::query()->create([
                'workspace_id' => $invitation->workspace_id,
                'user_id' => $user->id,
                'invited_by' => $invitation->invited_by,
                'job_title' => $invitation->job_title,
                'preset_key' => $invitation->preset_key,
                'access_scope' => $invitation->access_scope,
                'allowed_case_file_ids' => $invitation->allowed_case_file_ids,
                'status' => ConsultantWorkspaceMember::STATUS_ACTIVE,
                'last_login_at' => now(),
            ]);

            ConsultantWorkspaceMemberPermission::query()->create([
                'member_id' => $member->id,
                'permissions' => $this->catalog->sanitize($invitation->permissions_snapshot ?? []),
            ]);

            $invitation->update([
                'accepted_at' => now(),
                'accepted_user_id' => $user->id,
            ]);

            $plainToken = $user->createToken('password-auth')->plainTextToken;
        });

        $this->audit->record(
            'invite_accepted',
            'invitation',
            $invitation->id,
            $invitation->workspace_id,
            null,
            ['user_id' => $user?->id],
            $user?->id,
        );
        $this->notify->invitationAccepted($invitation->fresh(['workspace.owner']), $user);

        return ['user' => $user->fresh('roles'), 'token' => $plainToken];
    }

    public function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    private function rawToken(): string
    {
        return Str::random(48);
    }

    private function assertEmailAvailable(string $email, ?int $ignoreInvitationId = null): void
    {
        if (User::query()->whereRaw('LOWER(email) = ?', [$email])->exists()) {
            throw ValidationException::withMessages([
                'email' => ['This email cannot be invited.'],
            ]);
        }

        $otherPending = ConsultantWorkspaceInvitation::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->when($ignoreInvitationId, fn ($q) => $q->where('id', '!=', $ignoreInvitationId))
            ->exists();

        if ($otherPending) {
            throw ValidationException::withMessages([
                'email' => ['This email cannot be invited.'],
            ]);
        }
    }

    private function sendMail(
        ConsultantWorkspaceInvitation $invitation,
        string $token,
        ConsultantWorkspace $workspace,
        User $owner,
    ): void {
        app(\App\Services\IntegrationSettingsService::class)->applyRuntimeConfig();

        $url = rtrim((string) config('team.invite_host'), '/').'/team/invite/'.$token;

        Mail::to($invitation->email)->send(new TeamInvitationMail(
            $invitation,
            $url,
            $workspace->name,
            $owner->name,
        ));
    }
}

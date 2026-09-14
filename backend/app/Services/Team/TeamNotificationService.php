<?php

namespace App\Services\Team;

use App\Enums\NotificationType;
use App\Models\CaseFile;
use App\Models\ConsultantWorkspaceInvitation;
use App\Models\ConsultantWorkspaceMember;
use App\Models\User;
use App\Services\Notifications\NotificationService;

class TeamNotificationService
{
    public function __construct(private NotificationService $notifications) {}

    public function invitationAccepted(ConsultantWorkspaceInvitation $invitation, User $staff): void
    {
        $owner = $invitation->workspace?->owner;
        if (! $owner) {
            return;
        }

        $this->notifications->dispatch(
            $owner,
            NotificationType::TEAM_INVITE_ACCEPTED,
            'Team invitation accepted',
            $staff->name.' accepted your invitation and joined the practice workspace.',
            $this->teamUrl(),
            'team-invite-accepted:'.$invitation->id,
            $invitation,
        );
    }

    public function assignedToCase(ConsultantWorkspaceMember $member, CaseFile $case): void
    {
        $user = $member->user;
        if (! $user) {
            return;
        }

        $this->notifications->dispatch(
            $user,
            NotificationType::TEAM_ASSIGNED,
            'You were assigned to a case',
            'You now have access to case #'.$case->id.($case->name ? ' ('.$case->name.')' : '').'.',
            $this->clientUrl($case->client_profile_id),
            'team-assigned:'.$member->id.':'.$case->id,
            $case,
        );
    }

    public function removedFromCase(ConsultantWorkspaceMember $member, CaseFile $case): void
    {
        $user = $member->user;
        if (! $user) {
            return;
        }

        $this->notifications->dispatch(
            $user,
            NotificationType::TEAM_REMOVED,
            'You were removed from a case',
            'Your assignment to case #'.$case->id.' was removed.',
            $this->teamUrl(),
            'team-removed:'.$member->id.':'.$case->id.':'.now()->timestamp,
            $case,
        );
    }

    public function deactivated(ConsultantWorkspaceMember $member): void
    {
        $user = $member->user;
        if (! $user) {
            return;
        }

        $this->notifications->dispatch(
            $user,
            NotificationType::TEAM_DEACTIVATED,
            'Your team access was deactivated',
            'The practice owner deactivated your access. Contact them if this was unexpected.',
            null,
            'team-deactivated:'.$member->id.':'.($member->deactivated_at?->timestamp ?? now()->timestamp),
            $member,
        );
    }

    public function accessUpdated(ConsultantWorkspaceMember $member): void
    {
        $user = $member->user;
        if (! $user) {
            return;
        }

        $this->notifications->dispatch(
            $user,
            NotificationType::TEAM_ACCESS_UPDATED,
            'Your workspace access was updated',
            'The practice owner changed your permissions or case scope.',
            $this->teamUrl(),
            'team-access-updated:'.$member->id.':'.now()->format('YmdH'),
            $member,
        );
    }

    private function teamUrl(): string
    {
        return rtrim((string) config('team.invite_host'), '/').'/dashboard/team';
    }

    private function clientUrl(?int $profileId): string
    {
        if (! $profileId) {
            return $this->teamUrl();
        }

        return rtrim((string) env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/')
            .'/dashboard/clients/'.$profileId.'/workspace';
    }
}

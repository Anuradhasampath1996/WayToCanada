<?php

namespace App\Services\Team;

use App\Models\CaseFile;
use App\Models\CaseTeamAssignment;
use App\Models\ConsultantWorkspaceMember;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class TeamCaseAssignmentService
{
    public function __construct(
        private TeamAuditService $audit,
        private TeamNotificationService $notify,
    ) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function listForCase(CaseFile $case): array
    {
        return CaseTeamAssignment::query()
            ->with(['member.user:id,name,email', 'member.permissionSet'])
            ->where('case_file_id', $case->id)
            ->get()
            ->map(fn (CaseTeamAssignment $row) => $this->serialize($row))
            ->all();
    }

    public function assign(CaseFile $case, ConsultantWorkspaceMember $member, User $actor, string $role): CaseTeamAssignment
    {
        if ((int) $member->workspace?->owner_user_id !== (int) $case->consultant_id) {
            throw ValidationException::withMessages([
                'member_id' => ['This staff member does not belong to this workspace.'],
            ]);
        }

        if (! $member->isActive()) {
            throw ValidationException::withMessages([
                'member_id' => ['Only active staff can be assigned.'],
            ]);
        }

        if ($role === CaseTeamAssignment::ROLE_PRIMARY) {
            CaseTeamAssignment::query()
                ->where('case_file_id', $case->id)
                ->where('assignment_role', CaseTeamAssignment::ROLE_PRIMARY)
                ->update(['assignment_role' => CaseTeamAssignment::ROLE_COLLABORATOR]);
        }

        $assignment = CaseTeamAssignment::query()->updateOrCreate(
            ['case_file_id' => $case->id, 'member_id' => $member->id],
            ['assignment_role' => $role, 'assigned_by' => $actor->id],
        );

        $this->audit->record(
            'case_assigned',
            'case_assignment',
            $assignment->id,
            $member->workspace_id,
            null,
            ['case_file_id' => $case->id, 'member_id' => $member->id, 'role' => $role],
            $actor->id,
        );
        $this->notify->assignedToCase($member->load('user'), $case);

        return $assignment->fresh(['member.user']);
    }

    public function unassign(CaseFile $case, ConsultantWorkspaceMember $member, User $actor): void
    {
        $assignment = CaseTeamAssignment::query()
            ->where('case_file_id', $case->id)
            ->where('member_id', $member->id)
            ->first();

        if (! $assignment) {
            return;
        }

        $assignment->delete();
        $this->audit->record(
            'case_unassigned',
            'case_assignment',
            $assignment->id,
            $member->workspace_id,
            ['case_file_id' => $case->id, 'member_id' => $member->id],
            null,
            $actor->id,
        );
        $this->notify->removedFromCase($member->load('user'), $case);
    }

    /** @return array<string, mixed> */
    private function serialize(CaseTeamAssignment $row): array
    {
        return [
            'id' => $row->id,
            'member_id' => $row->member_id,
            'assignment_role' => $row->assignment_role,
            'assigned_by' => $row->assigned_by,
            'member' => [
                'id' => $row->member?->id,
                'user_id' => $row->member?->user_id,
                'name' => $row->member?->user?->name,
                'email' => $row->member?->user?->email,
                'job_title' => $row->member?->job_title,
                'preset_key' => $row->member?->preset_key,
                'status' => $row->member?->status,
            ],
        ];
    }
}

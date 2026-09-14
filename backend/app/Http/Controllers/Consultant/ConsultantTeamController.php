<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\CaseTeamAssignment;
use App\Models\ConsultantWorkspaceInvitation;
use App\Models\ConsultantWorkspaceMember;
use App\Models\TeamAuditEvent;
use App\Services\Team\TeamAccess;
use App\Services\Team\TeamInvitationService;
use App\Services\Team\TeamMemberService;
use App\Services\Team\TeamPermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantTeamController extends Controller
{
    public function __construct(
        private TeamAccess $access,
        private TeamInvitationService $invitations,
        private TeamMemberService $members,
        private TeamPermissionCatalog $catalog,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $workspace = $this->access->authorizeOwnerWorkspace($request->user());
        $workspace->load('owner:id,name,email,company_name');

        $members = ConsultantWorkspaceMember::query()
            ->with(['user:id,name,email,created_at', 'permissionSet'])
            ->where('workspace_id', $workspace->id)
            ->orderBy('id')
            ->get()
            ->map(function (ConsultantWorkspaceMember $member) {
                $assignmentCount = CaseTeamAssignment::query()->where('member_id', $member->id)->count();

                return [
                    'id' => $member->id,
                    'user_id' => $member->user_id,
                    'name' => $member->user?->name,
                    'email' => $member->user?->email,
                    'job_title' => $member->job_title,
                    'preset_key' => $member->preset_key,
                    'access_scope' => $member->access_scope,
                    'allowed_case_file_ids' => $member->allowedCaseFileIds(),
                    'status' => $member->status,
                    'last_login_at' => $member->last_login_at?->toIso8601String(),
                    'permissions' => $member->permissionMap(),
                    'assignment_count' => $assignmentCount,
                    'created_at' => $member->created_at?->toIso8601String(),
                ];
            });

        $invites = ConsultantWorkspaceInvitation::query()
            ->where('workspace_id', $workspace->id)
            ->latest()
            ->get()
            ->map(fn (ConsultantWorkspaceInvitation $invite) => $this->serializeInvitation($invite));

        return response()->json([
            'workspace' => [
                'id' => $workspace->id,
                'name' => $workspace->name,
                'owner_name' => $workspace->owner?->name,
                'owner_email' => $workspace->owner?->email,
            ],
            'members' => $members,
            'invitations' => $invites,
        ]);
    }

    public function session(Request $request): JsonResponse
    {
        $this->access->assertStaffMayUseWorkspace($request->user());

        return response()->json($this->access->sessionContext($request->user()));
    }

    public function presets(): JsonResponse
    {
        $presets = collect($this->catalog->presets())->map(fn (array $preset, string $key) => [
            'key' => $key,
            'name' => $preset['name'],
            'permissions' => $this->catalog->fromPreset($key),
        ])->values();

        return response()->json([
            'presets' => $presets,
            'assignable' => $this->catalog->assignable(),
            'owner_only' => $this->catalog->ownerOnly(),
        ]);
    }

    public function storeInvitation(Request $request): JsonResponse
    {
        $workspace = $this->access->authorizeOwnerWorkspace($request->user());
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'preset_key' => ['nullable', 'string', 'max:64'],
            'access_scope' => ['required', 'in:all_cases,assigned_cases,selected_cases'],
            'allowed_case_file_ids' => ['nullable', 'array'],
            'allowed_case_file_ids.*' => ['integer'],
            'permissions' => ['nullable', 'array'],
        ]);

        $result = $this->invitations->invite($workspace, $request->user(), $data);

        return response()->json([
            'invitation' => $this->serializeInvitation($result['invitation']),
            'message' => 'Invitation sent.',
        ], 201);
    }

    public function resendInvitation(Request $request, ConsultantWorkspaceInvitation $invitation): JsonResponse
    {
        $workspace = $this->access->authorizeOwnerWorkspace($request->user());
        $this->assertInvitation($workspace->id, $invitation);
        $result = $this->invitations->resend($invitation, $request->user());

        return response()->json([
            'invitation' => $this->serializeInvitation($result['invitation']),
            'message' => 'Invitation resent.',
        ]);
    }

    public function destroyInvitation(Request $request, ConsultantWorkspaceInvitation $invitation): JsonResponse
    {
        $workspace = $this->access->authorizeOwnerWorkspace($request->user());
        $this->assertInvitation($workspace->id, $invitation);
        $this->invitations->revoke($invitation, $request->user());

        return response()->json(['message' => 'Invitation cancelled.']);
    }

    public function showMember(Request $request, ConsultantWorkspaceMember $member): JsonResponse
    {
        $workspace = $this->access->authorizeOwnerWorkspace($request->user());
        $this->assertMember($workspace->id, $member);
        $member->load(['user:id,name,email', 'permissionSet', 'assignments.caseFile:id,name,client_profile_id,status']);

        return response()->json([
            'id' => $member->id,
            'user_id' => $member->user_id,
            'name' => $member->user?->name,
            'email' => $member->user?->email,
            'job_title' => $member->job_title,
            'preset_key' => $member->preset_key,
            'access_scope' => $member->access_scope,
            'allowed_case_file_ids' => $member->allowedCaseFileIds(),
            'status' => $member->status,
            'permissions' => $member->permissionMap(),
            'assignments' => $member->assignments->map(fn ($row) => [
                'id' => $row->id,
                'case_file_id' => $row->case_file_id,
                'assignment_role' => $row->assignment_role,
                'case_name' => $row->caseFile?->name,
                'client_profile_id' => $row->caseFile?->client_profile_id,
            ]),
        ]);
    }

    public function updateMember(Request $request, ConsultantWorkspaceMember $member): JsonResponse
    {
        $workspace = $this->access->authorizeOwnerWorkspace($request->user());
        $this->assertMember($workspace->id, $member);
        $data = $request->validate([
            'job_title' => ['nullable', 'string', 'max:255'],
            'preset_key' => ['nullable', 'string', 'max:64'],
        ]);

        return response()->json($this->members->update($member, $request->user(), $data));
    }

    public function updatePermissions(Request $request, ConsultantWorkspaceMember $member): JsonResponse
    {
        $workspace = $this->access->authorizeOwnerWorkspace($request->user());
        $this->assertMember($workspace->id, $member);
        $data = $request->validate([
            'permissions' => ['required', 'array'],
        ]);

        $updated = $this->members->updatePermissions($member, $request->user(), $data['permissions']);

        return response()->json([
            'id' => $updated->id,
            'permissions' => $updated->permissionMap(),
        ]);
    }

    public function updateScope(Request $request, ConsultantWorkspaceMember $member): JsonResponse
    {
        $workspace = $this->access->authorizeOwnerWorkspace($request->user());
        $this->assertMember($workspace->id, $member);
        $data = $request->validate([
            'access_scope' => ['required', 'in:all_cases,assigned_cases,selected_cases'],
            'allowed_case_file_ids' => ['nullable', 'array'],
            'allowed_case_file_ids.*' => ['integer'],
        ]);

        $updated = $this->members->updateScope(
            $member,
            $request->user(),
            $data['access_scope'],
            $data['allowed_case_file_ids'] ?? [],
        );

        return response()->json([
            'id' => $updated->id,
            'access_scope' => $updated->access_scope,
            'allowed_case_file_ids' => $updated->allowedCaseFileIds(),
        ]);
    }

    public function deactivate(Request $request, ConsultantWorkspaceMember $member): JsonResponse
    {
        $workspace = $this->access->authorizeOwnerWorkspace($request->user());
        $this->assertMember($workspace->id, $member);

        return response()->json($this->members->deactivate($member, $request->user()));
    }

    public function reactivate(Request $request, ConsultantWorkspaceMember $member): JsonResponse
    {
        $workspace = $this->access->authorizeOwnerWorkspace($request->user());
        $this->assertMember($workspace->id, $member);

        return response()->json($this->members->reactivate($member, $request->user()));
    }

    public function revokeSessions(Request $request, ConsultantWorkspaceMember $member): JsonResponse
    {
        $workspace = $this->access->authorizeOwnerWorkspace($request->user());
        $this->assertMember($workspace->id, $member);
        $this->members->revokeSessions($member, $request->user());

        return response()->json(['message' => 'Sessions revoked.']);
    }

    public function activity(Request $request): JsonResponse
    {
        $workspace = $this->access->authorizeOwnerWorkspace($request->user());
        $events = TeamAuditEvent::query()
            ->where('workspace_id', $workspace->id)
            ->latest()
            ->limit(100)
            ->get();

        return response()->json(['data' => $events]);
    }

    private function assertInvitation(int $workspaceId, ConsultantWorkspaceInvitation $invitation): void
    {
        if ((int) $invitation->workspace_id !== $workspaceId) {
            abort(404, 'Not found.');
        }
    }

    private function assertMember(int $workspaceId, ConsultantWorkspaceMember $member): void
    {
        if ((int) $member->workspace_id !== $workspaceId) {
            abort(404, 'Not found.');
        }
    }

    /** @return array<string, mixed> */
    private function serializeInvitation(ConsultantWorkspaceInvitation $invite): array
    {
        $status = 'sent';
        if ($invite->accepted_at) {
            $status = 'accepted';
        } elseif ($invite->revoked_at) {
            $status = 'revoked';
        } elseif ($invite->expires_at?->isPast()) {
            $status = 'expired';
        }

        return [
            'id' => $invite->id,
            'email' => $invite->email,
            'name' => $invite->name,
            'job_title' => $invite->job_title,
            'preset_key' => $invite->preset_key,
            'access_scope' => $invite->access_scope,
            'status' => $status,
            'expires_at' => $invite->expires_at?->toIso8601String(),
            'accepted_at' => $invite->accepted_at?->toIso8601String(),
            'created_at' => $invite->created_at?->toIso8601String(),
        ];
    }
}

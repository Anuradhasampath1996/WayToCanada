<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\CaseTeamAssignment;
use App\Models\ClientProfile;
use App\Models\ConsultantWorkspaceMember;
use App\Services\CaseFileLifecycleService;
use App\Services\Team\TeamAccess;
use App\Services\Team\TeamCaseAssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantCaseTeamController extends Controller
{
    public function __construct(
        private TeamAccess $access,
        private TeamCaseAssignmentService $assignments,
        private CaseFileLifecycleService $lifecycle,
    ) {}

    public function show(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->access->requireOwner($request->user(), $profile);
        $case = $this->lifecycle->resolveActiveCaseFile($profile, (int) $profile->consultant_id, createIfMissing: false);
        if (! $case) {
            abort(404, 'No case file found.');
        }

        $workspace = $this->access->authorizeOwnerWorkspace($request->user());
        $members = ConsultantWorkspaceMember::query()
            ->with('user:id,name,email')
            ->where('workspace_id', $workspace->id)
            ->where('status', ConsultantWorkspaceMember::STATUS_ACTIVE)
            ->get()
            ->map(fn (ConsultantWorkspaceMember $member) => [
                'id' => $member->id,
                'name' => $member->user?->name,
                'email' => $member->user?->email,
                'job_title' => $member->job_title,
                'assignment_count' => CaseTeamAssignment::query()->where('member_id', $member->id)->count(),
            ]);

        return response()->json([
            'assignments' => $this->assignments->listForCase($case),
            'members' => $members,
        ]);
    }

    public function store(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->access->requireOwner($request->user(), $profile);
        $case = $this->lifecycle->resolveActiveCaseFile($profile, (int) $profile->consultant_id, createIfMissing: false);
        if (! $case) {
            abort(404, 'No case file found.');
        }

        $data = $request->validate([
            'member_id' => ['required', 'integer'],
            'assignment_role' => ['nullable', 'in:primary_case_manager,collaborator'],
        ]);

        $member = ConsultantWorkspaceMember::query()->findOrFail($data['member_id']);
        $assignment = $this->assignments->assign(
            $case,
            $member,
            $request->user(),
            $data['assignment_role'] ?? CaseTeamAssignment::ROLE_COLLABORATOR,
        );

        return response()->json([
            'assignments' => $this->assignments->listForCase($case),
            'assignment' => $assignment,
        ], 201);
    }

    public function destroy(Request $request, ClientProfile $profile, ConsultantWorkspaceMember $member): JsonResponse
    {
        $this->access->requireOwner($request->user(), $profile);
        $case = $this->lifecycle->resolveActiveCaseFile($profile, (int) $profile->consultant_id, createIfMissing: false);
        if (! $case) {
            abort(404, 'No case file found.');
        }

        $this->assignments->unassign($case, $member, $request->user());

        return response()->json([
            'assignments' => $this->assignments->listForCase($case),
            'message' => 'Assignment removed.',
        ]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\CaseHistoryEvent;
use App\Models\ClientProfile;
use App\Services\CaseFileLifecycleService;
use App\Services\CaseRequirementPlanService;
use App\Support\CaseWorkflowStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantCaseRequirementPlanController extends Controller
{
    public function __construct(
        private CaseRequirementPlanService $plans,
        private CaseFileLifecycleService $lifecycle,
    ) {}

    public function show(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->requireOwnedCase($request, $profile);
        $plan = $this->plans->currentPlan($caseFile);

        return response()->json([
            'requirement_plan' => $this->plans->serializePlan($plan),
            'workflow' => CaseWorkflowStatus::serialize($caseFile->workflow_status, $caseFile->status),
            'confirmed_submission_portal' => $caseFile->confirmed_submission_portal,
        ]);
    }

    public function preview(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->requireOwnedCase($request, $profile);
        $data = $request->validate([
            'pathway_code' => 'nullable|string|max:64',
            'immigration_pathway' => 'nullable|string|max:255',
        ]);

        $preview = $this->plans->preview(
            $caseFile,
            $data['pathway_code'] ?? null,
            $data['immigration_pathway'] ?? null,
        );

        $current = $this->plans->currentPlan($caseFile);

        return response()->json([
            'registry_key' => $preview['registry_key'],
            'proposed_snapshot' => $preview['snapshot'],
            'definition_version' => $preview['definition']?->version,
            'current_plan' => $this->plans->serializePlan($current),
            'diff' => $current
                ? \App\Support\RequirementPlanDiff::compare($current->snapshot ?? [], $preview['snapshot'])
                : null,
        ]);
    }

    public function registryDiff(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->requireOwnedCase($request, $profile);

        return response()->json($this->plans->registryDiff($caseFile));
    }

    public function applyRegistryUpdate(Request $request, ClientProfile $profile): JsonResponse
    {
        app(\App\Services\Team\TeamAccess::class)->requireOwner($request->user(), $profile);
        $caseFile = $this->requireOwnedCase($request, $profile);
        $data = $request->validate([
            'note' => 'nullable|string|max:2000',
        ]);

        try {
            $plan = $this->plans->applyRegistryUpdate($caseFile, $request->user(), $data['note'] ?? null);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'requirement_plan' => $this->plans->serializePlan($plan),
            'message' => 'Registry update applied. Previous plan version kept in case history.',
        ]);
    }

    public function confirmPortal(Request $request, ClientProfile $profile): JsonResponse
    {
        app(\App\Services\Team\TeamAccess::class)->requireOwner($request->user(), $profile);
        $caseFile = $this->requireOwnedCase($request, $profile);
        $data = $request->validate([
            'portal' => 'required|string|max:64',
            'note' => 'nullable|string|max:500',
        ]);

        try {
            $plan = $this->plans->confirmSubmissionPortal(
                $caseFile,
                $request->user(),
                $data['portal'],
                $data['note'] ?? null,
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'requirement_plan' => $this->plans->serializePlan($plan),
            'confirmed_submission_portal' => $caseFile->fresh()->confirmed_submission_portal,
            'auto_submitted' => false,
            'message' => 'Submission portal confirmed. Nothing was submitted to IRCC or a provincial portal.',
        ]);
    }

    public function history(Request $request, ClientProfile $profile): JsonResponse
    {
        $caseFile = $this->requireOwnedCase($request, $profile);

        $events = CaseHistoryEvent::query()
            ->where('case_file_id', $caseFile->id)
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (CaseHistoryEvent $event) => [
                'id' => $event->id,
                'event_type' => $event->event_type,
                'title' => $event->title,
                'description' => $event->description,
                'payload' => $event->payload,
                'actor_user_id' => $event->actor_user_id,
                'occurred_at' => $event->occurred_at?->toIso8601String(),
            ]);

        return response()->json(['events' => $events]);
    }

    private function requireOwnedCase(Request $request, ClientProfile $profile): \App\Models\CaseFile
    {
        app(\App\Services\Team\TeamAccess::class)->authorize($request->user(), $profile);

        $caseFile = $this->lifecycle->resolveActiveCaseFile($profile, (int) $profile->consultant_id, createIfMissing: false);
        if (! $caseFile) {
            abort(404, 'No case file found.');
        }

        return $caseFile;
    }
}

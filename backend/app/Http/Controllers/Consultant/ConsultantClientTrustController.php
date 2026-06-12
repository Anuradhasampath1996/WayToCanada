<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\CaseFeeMilestone;
use App\Models\ClientProfile;
use App\Models\MilestoneInvoice;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\TrustLedger\TrustLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantClientTrustController extends Controller
{
    public function __construct(
        private TrustLedgerService $trust,
        private ClientActivityTriggers $activity,
    ) {}

    /** GET /api/v1/consultant/clients/{profile}/trust */
    public function show(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorize($request, $profile);

        return response()->json($this->trust->dashboardForProfile($profile));
    }

    /** POST /api/v1/consultant/clients/{profile}/trust/deposit */
    public function recordDeposit(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorize($request, $profile);

        $data = $request->validate([
            'amount'    => 'required|numeric|min:0.01|max:999999',
            'method'    => 'required|string|max:100',
            'reference' => 'nullable|string|max:200',
            'notes'     => 'nullable|string|max:2000',
        ]);

        $entry = $this->trust->recordManualDeposit(
            $profile,
            $request->user(),
            (float) $data['amount'],
            $data['method'],
            $data['reference'] ?? null,
            $data['notes'] ?? null,
            $request,
        );

        $this->activity->onTrustDeposit($profile, $request->user(), (float) $data['amount'], $request);

        return response()->json([
            'message' => 'Trust deposit recorded.',
            'data'    => $this->trust->dashboardForProfile($profile->fresh()),
            'entry'   => $this->trust->formatLedgerEntry($entry),
        ], 201);
    }

    /** POST /api/v1/consultant/clients/{profile}/trust/refund */
    public function recordRefund(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorize($request, $profile);

        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01|max:999999',
            'reason' => 'required|string|max:2000',
        ]);

        $entry = $this->trust->recordRefund(
            $profile,
            $request->user(),
            (float) $data['amount'],
            $data['reason'],
            $request,
        );

        $this->activity->onTrustRefund($profile, $request->user(), (float) $data['amount'], $request);

        return response()->json([
            'message' => 'Trust refund recorded.',
            'data'    => $this->trust->dashboardForProfile($profile->fresh()),
            'entry'   => $this->trust->formatLedgerEntry($entry),
        ]);
    }

    /** POST /api/v1/consultant/clients/{profile}/trust/milestones/{milestone}/complete */
    public function completeMilestone(Request $request, ClientProfile $profile, CaseFeeMilestone $milestone): JsonResponse
    {
        $this->authorize($request, $profile);
        $this->assertMilestone($profile, $milestone);

        $milestone = $this->trust->completeMilestone($milestone, $request->user());
        $this->activity->onMilestoneCompleted($profile, $milestone, $request->user(), $request);

        return response()->json([
            'message'   => 'Milestone marked complete.',
            'milestone' => $this->trust->formatMilestone($milestone),
            'data'      => $this->trust->dashboardForProfile($profile),
        ]);
    }

    /** POST /api/v1/consultant/clients/{profile}/trust/milestones/{milestone}/invoice */
    public function issueInvoice(Request $request, ClientProfile $profile, CaseFeeMilestone $milestone): JsonResponse
    {
        $this->authorize($request, $profile);
        $this->assertMilestone($profile, $milestone);

        $data = $request->validate(['notes' => 'nullable|string|max:2000']);

        $invoice = $this->trust->issueInvoice($milestone, $request->user(), $data['notes'] ?? null);
        $this->activity->onMilestoneInvoiced($profile, $invoice, $request->user(), $request);

        return response()->json([
            'message' => 'Milestone invoice issued. Awaiting client approval.',
            'invoice' => $this->trust->formatInvoice($invoice),
            'data'    => $this->trust->dashboardForProfile($profile),
        ], 201);
    }

    /** POST /api/v1/consultant/clients/{profile}/trust/invoices/{invoice}/release */
    public function releaseInvoice(Request $request, ClientProfile $profile, MilestoneInvoice $invoice): JsonResponse
    {
        $this->authorize($request, $profile);
        $this->assertInvoice($profile, $invoice);

        $invoice = $this->trust->releaseInvoice($invoice, $request->user());
        $this->activity->onTrustReleased($profile, $invoice, $request->user(), $request);

        return response()->json([
            'message' => 'Funds released from trust to operating account.',
            'invoice' => $this->trust->formatInvoice($invoice),
            'data'    => $this->trust->dashboardForProfile($profile),
        ]);
    }

    private function authorize(Request $request, ClientProfile $profile): void
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }
    }

    private function assertMilestone(ClientProfile $profile, CaseFeeMilestone $milestone): void
    {
        if ($milestone->client_profile_id !== $profile->id) {
            abort(404);
        }
    }

    private function assertInvoice(ClientProfile $profile, MilestoneInvoice $invoice): void
    {
        if ($invoice->client_profile_id !== $profile->id) {
            abort(404);
        }
    }
}

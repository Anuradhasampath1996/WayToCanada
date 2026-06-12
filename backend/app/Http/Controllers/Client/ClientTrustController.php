<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\MilestoneInvoice;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\TrustLedger\TrustLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientTrustController extends Controller
{
    public function __construct(
        private TrustLedgerService $trust,
        private ClientActivityTriggers $activity,
    ) {}

    /** GET /api/v1/client/trust */
    public function show(Request $request): JsonResponse
    {
        $profile = $request->user()->clientProfile;
        if (! $profile) {
            return response()->json(['trust_account' => null, 'milestones' => [], 'ledger' => [], 'pending_invoices' => []]);
        }

        return response()->json($this->trust->dashboardForProfile($profile));
    }

    /** POST /api/v1/client/trust/invoices/{invoice}/approve */
    public function approveInvoice(Request $request, MilestoneInvoice $invoice): JsonResponse
    {
        $profile = $request->user()->clientProfile;
        if (! $profile || $invoice->client_profile_id !== $profile->id) {
            abort(403);
        }

        $invoice = $this->trust->approveInvoice($invoice, $request->user());
        $this->activity->onMilestoneInvoiceApproved($profile, $invoice, $request->user(), $request);

        return response()->json([
            'message' => 'Invoice approved. Your consultant may now release earned fees from trust.',
            'invoice' => $this->trust->formatInvoice($invoice),
            'data'    => $this->trust->dashboardForProfile($profile),
        ]);
    }
}

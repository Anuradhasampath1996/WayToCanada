<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ConsultantMarketingOrder;
use App\Models\SubscriptionPaymentRecord;
use App\Services\ConsultantBillingService;
use App\Services\SubscriptionInvoicePdfService;
use App\Services\SubscriptionPaymentRecorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantBillingController extends Controller
{
    public function __construct(
        private ConsultantBillingService $billing,
        private SubscriptionPaymentRecorder $recorder,
        private SubscriptionInvoicePdfService $invoicePdf,
    ) {}

    public function show(Request $request): JsonResponse
    {
        try {
            return response()->json($this->billing->overview($request->user()));
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    public function invoices(Request $request): JsonResponse
    {
        try {
            return response()->json(['data' => $this->billing->invoices($request->user())]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    public function cancel(Request $request): JsonResponse
    {
        try {
            $result = $this->billing->cancel($request->user());

            return response()->json($result);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function updateAutoRenew(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled' => 'required|boolean',
        ]);

        try {
            $result = $this->billing->setAutoRenew($request->user(), (bool) $data['enabled']);

            return response()->json($result);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function showPayment(Request $request, SubscriptionPaymentRecord $subscriptionPaymentRecord): JsonResponse
    {
        if ($subscriptionPaymentRecord->user_id !== $request->user()->id) {
            abort(404);
        }

        return response()->json([
            'data' => $this->recorder->formatRecord($subscriptionPaymentRecord, 'consultant'),
        ]);
    }

    public function downloadInvoice(Request $request, SubscriptionPaymentRecord $subscriptionPaymentRecord)
    {
        if ($subscriptionPaymentRecord->user_id !== $request->user()->id) {
            abort(404);
        }

        try {
            // Always generate the branded RCICMASTER tax invoice.
            // Redirecting to Stripe's hosted PDF breaks browser fetch() (CORS → "Failed to fetch").
            $pdf = $this->invoicePdf->generate($subscriptionPaymentRecord);

            return $pdf->download($this->invoicePdf->filename($subscriptionPaymentRecord));
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Could not generate invoice PDF. Please try again or contact support.',
            ], 500);
        }
    }

    public function cancelMarketingOrder(Request $request, ConsultantMarketingOrder $order): JsonResponse
    {
        try {
            $result = $this->billing->cancelMarketingOrder($request->user(), $order);

            return response()->json($result);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function updateMarketingAutoRenew(Request $request, ConsultantMarketingOrder $order): JsonResponse
    {
        $data = $request->validate([
            'enabled' => 'required|boolean',
        ]);

        try {
            $result = $this->billing->setMarketingAutoRenew($request->user(), $order, (bool) $data['enabled']);

            return response()->json($result);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ConsultantSubscription;
use App\Models\SubscriptionPaymentRecord;
use App\Services\SubscriptionInvoicePdfService;
use App\Services\SubscriptionPaymentRecorder;
use App\Support\AdminCsvExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSubscriptionPaymentsController extends Controller
{
    public function __construct(
        private SubscriptionPaymentRecorder $recorder,
        private SubscriptionInvoicePdfService $invoicePdf,
    ) {}

    /**
     * GET /api/v1/admin/subscription-payments
     */
    public function index(Request $request): JsonResponse
    {
        $query = $this->filteredQuery($request);

        $payments = $query->paginate($request->integer('per_page', 20));

        $statsQuery = clone $this->filteredQuery($request);
        $totalTax = (float) (clone $statsQuery)->sum('tax_amount');
        $totalPaid = (float) (clone $statsQuery)->sum('total');
        $activeSubs = ConsultantSubscription::where('status', 'active')->count();

        return response()->json([
            'data' => collect($payments->items())->map(fn ($p) => $this->recorder->formatRecord($p, 'admin'))->values(),
            'meta' => [
                'current_page' => $payments->currentPage(),
                'last_page'    => $payments->lastPage(),
                'per_page'     => $payments->perPage(),
                'total'        => $payments->total(),
            ],
            'stats' => [
                'total_payments'        => (clone $statsQuery)->count(),
                'total_collected_cad'   => round($totalPaid, 2),
                'total_tax_cad'         => round($totalTax, 2),
                'active_subscriptions'  => $activeSubs,
                'total_subscriptions'   => SubscriptionPaymentRecord::count(),
                'trials'                => ConsultantSubscription::where('status', 'trial')->count(),
                'total_revenue_cad'     => round($totalPaid, 2),
            ],
        ]);
    }

    public function export(Request $request)
    {
        $rows = $this->filteredQuery($request)->limit(5000)->get();

        return AdminCsvExport::download(
            'subscription-payments-' . now()->format('Y-m-d') . '.csv',
            [
                'ID', 'Category', 'Type', 'Consultant', 'Email', 'Service/Package',
                'Subtotal', 'Tax', 'Total', 'Province', 'Country', 'Paid at',
            ],
            $rows->map(function (SubscriptionPaymentRecord $p) {
                $p->loadMissing('user:id,name,email', 'package:id,name');
                $formatted = $this->recorder->formatRecord($p, 'admin');

                return [
                    $p->id,
                    $formatted['category'] ?? 'subscription',
                    $p->payment_type,
                    $p->user?->name,
                    $p->user?->email,
                    $formatted['package_name'] ?? $formatted['service_name'] ?? '',
                    $formatted['subtotal'],
                    $formatted['tax_amount'],
                    $formatted['total'],
                    $formatted['province'],
                    $formatted['country'],
                    $formatted['paid_at'],
                ];
            }),
        );
    }

    /**
     * GET /api/v1/admin/subscription-payments/{subscriptionPaymentRecord}
     */
    public function show(SubscriptionPaymentRecord $subscriptionPaymentRecord): JsonResponse
    {
        return response()->json([
            'data' => $this->recorder->formatRecord($subscriptionPaymentRecord, 'admin'),
        ]);
    }

    public function downloadInvoice(SubscriptionPaymentRecord $subscriptionPaymentRecord)
    {
        if ($subscriptionPaymentRecord->invoice_pdf && str_starts_with($subscriptionPaymentRecord->invoice_pdf, 'http')) {
            return redirect()->away($subscriptionPaymentRecord->invoice_pdf);
        }

        return $this->invoicePdf->generate($subscriptionPaymentRecord)
            ->download($this->invoicePdf->filename($subscriptionPaymentRecord));
    }

    private function filteredQuery(Request $request)
    {
        $query = SubscriptionPaymentRecord::with(['user:id,name,email', 'package:id,name', 'subscription:id,status,billing_cycle'])
            ->latest('paid_at');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'ilike', "%{$search}%")
                    ->orWhereHas('user', fn ($u) => $u
                        ->where('name', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%"));
            });
        }

        if ($request->filled('payment_type')) {
            $query->where('payment_type', $request->payment_type);
        }

        if ($request->filled('payment_category')) {
            $query->where('payment_category', $request->payment_category);
        }

        if ($request->filled('country')) {
            $query->where('country', strtoupper($request->country));
        }

        AdminCsvExport::applyDateFilters($query, $request->date_from, $request->date_to, 'paid_at');

        return $query;
    }
}

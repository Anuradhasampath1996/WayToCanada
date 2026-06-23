<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ConsultantMarketingOrder;
use App\Support\AdminCsvExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminMarketingOrdersController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = $this->filteredQuery($request);
        $orders = $query->paginate($request->integer('per_page', 20));

        $paidTotal = (float) ConsultantMarketingOrder::whereIn('status', [
            ConsultantMarketingOrder::STATUS_PAID,
            ConsultantMarketingOrder::STATUS_ACTIVE,
        ])->selectRaw('COALESCE(SUM(amount + COALESCE(tax_amount, 0)), 0) as total')->value('total');

        return response()->json([
            'data' => collect($orders->items())->map(fn (ConsultantMarketingOrder $o) => $this->formatRow($o))->values(),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page'    => $orders->lastPage(),
                'per_page'     => $orders->perPage(),
                'total'        => $orders->total(),
            ],
            'stats' => [
                'total_orders'   => ConsultantMarketingOrder::whereIn('status', [
                    ConsultantMarketingOrder::STATUS_PAID,
                    ConsultantMarketingOrder::STATUS_ACTIVE,
                ])->count(),
                'total_revenue'  => round($paidTotal, 2),
                'pending_orders' => ConsultantMarketingOrder::where('status', ConsultantMarketingOrder::STATUS_PENDING)->count(),
            ],
        ]);
    }

    public function export(Request $request)
    {
        $rows = $this->filteredQuery($request)->limit(5000)->get();

        return AdminCsvExport::download(
            'marketing-orders-' . now()->format('Y-m-d') . '.csv',
            ['ID', 'Consultant', 'Email', 'Service', 'Status', 'Billing', 'Subtotal', 'Tax', 'Total', 'Province', 'Paid at'],
            $rows->map(fn (ConsultantMarketingOrder $o) => [
                $o->id,
                $o->user?->name,
                $o->user?->email,
                $o->service?->name,
                $o->status,
                $o->billing_type,
                (float) $o->amount,
                (float) ($o->tax_amount ?? 0),
                round((float) $o->amount + (float) ($o->tax_amount ?? 0), 2),
                $o->province,
                $o->paid_at?->toIso8601String(),
            ]),
        );
    }

    private function filteredQuery(Request $request)
    {
        $query = ConsultantMarketingOrder::with(['user:id,name,email', 'service:id,name,slug'])
            ->whereIn('status', [
                ConsultantMarketingOrder::STATUS_PAID,
                ConsultantMarketingOrder::STATUS_ACTIVE,
                ConsultantMarketingOrder::STATUS_PENDING,
                ConsultantMarketingOrder::STATUS_CANCELLED,
            ])
            ->latest('paid_at');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('user', fn ($u) => $u
                    ->where('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%"))
                    ->orWhereHas('service', fn ($s) => $s->where('name', 'ilike', "%{$search}%"));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        AdminCsvExport::applyDateFilters($query, $request->date_from, $request->date_to, 'paid_at');

        return $query;
    }

    /** @return array<string, mixed> */
    private function formatRow(ConsultantMarketingOrder $o): array
    {
        return [
            'id'              => $o->id,
            'status'          => $o->status,
            'billing_type'    => $o->billing_type,
            'amount'          => (float) $o->amount,
            'tax_amount'      => (float) ($o->tax_amount ?? 0),
            'total'           => round((float) $o->amount + (float) ($o->tax_amount ?? 0), 2),
            'province'        => $o->province,
            'billing_country' => $o->billing_country,
            'paid_at'         => $o->paid_at?->toIso8601String(),
            'user'            => $o->user ? [
                'id'    => $o->user->id,
                'name'  => $o->user->name,
                'email' => $o->user->email,
            ] : null,
            'service_name'    => $o->service?->name,
            'service_slug'    => $o->service?->slug,
        ];
    }
}

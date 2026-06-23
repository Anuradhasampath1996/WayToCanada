<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ConsultantStorageAddon;
use App\Models\SubscriptionPaymentRecord;
use App\Support\AdminCsvExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminStorageSubscriptionsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = $this->filteredQuery($request);
        $addons = $query->paginate($request->integer('per_page', 20));

        $activeCount = ConsultantStorageAddon::where('status', 'active')->count();

        $revenueTotal = (float) SubscriptionPaymentRecord::where('payment_category', SubscriptionPaymentRecord::CATEGORY_STORAGE)
            ->where('payment_status', SubscriptionPaymentRecord::STATUS_PAID)
            ->selectRaw('COALESCE(SUM(total), 0) as total')
            ->value('total');

        return response()->json([
            'data' => collect($addons->items())->map(fn (ConsultantStorageAddon $a) => [
                'id'                     => $a->id,
                'status'                 => $a->status,
                'billing_cycle'          => $a->billing_cycle,
                'extra_bytes'            => (int) $a->extra_bytes,
                'extra_bytes_gb'         => round((int) $a->extra_bytes / (1024 ** 3), 2),
                'starts_at'              => $a->starts_at?->toIso8601String(),
                'ends_at'                => $a->ends_at?->toIso8601String(),
                'stripe_subscription_id' => $a->stripe_subscription_id,
                'user'                   => $a->user ? [
                    'id'    => $a->user->id,
                    'name'  => $a->user->name,
                    'email' => $a->user->email,
                ] : null,
                'package_name'           => $a->package?->name,
            ])->values(),
            'meta' => [
                'current_page' => $addons->currentPage(),
                'last_page'    => $addons->lastPage(),
                'per_page'     => $addons->perPage(),
                'total'        => $addons->total(),
            ],
            'stats' => [
                'active_addons'  => $activeCount,
                'total_revenue'  => round($revenueTotal, 2),
                'total_addons'   => ConsultantStorageAddon::count(),
            ],
        ]);
    }

    public function export(Request $request)
    {
        $rows = $this->filteredQuery($request)->limit(5000)->get();

        return AdminCsvExport::download(
            'storage-subscriptions-' . now()->format('Y-m-d') . '.csv',
            ['ID', 'Consultant', 'Email', 'Package', 'Status', 'Cycle', 'Extra GB', 'Starts', 'Ends'],
            $rows->map(fn (ConsultantStorageAddon $a) => [
                $a->id,
                $a->user?->name,
                $a->user?->email,
                $a->package?->name,
                $a->status,
                $a->billing_cycle,
                round((int) $a->extra_bytes / (1024 ** 3), 2),
                $a->starts_at?->toIso8601String(),
                $a->ends_at?->toIso8601String(),
            ]),
        );
    }

    private function filteredQuery(Request $request)
    {
        $query = ConsultantStorageAddon::with([
            'user:id,name,email',
            'package:id,name,extra_gb,monthly_price,yearly_price',
        ])->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('user', fn ($u) => $u
                    ->where('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%"))
                    ->orWhereHas('package', fn ($p) => $p->where('name', 'ilike', "%{$search}%"));
            });
        }

        AdminCsvExport::applyDateFilters($query, $request->date_from, $request->date_to, 'starts_at');

        return $query;
    }
}

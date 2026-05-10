<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ConsultantSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSubscriptionPaymentsController extends Controller
{
    /**
     * GET /api/v1/admin/subscription-payments
     *
     * Returns a paginated list of all consultant subscriptions with
     * their user and package details, plus summary stats.
     */
    public function index(Request $request): JsonResponse
    {
        $query = ConsultantSubscription::with(['user', 'package'])
            ->latest();

        // Optional filters
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('billing_cycle')) {
            $query->where('billing_cycle', $request->billing_cycle);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('email', 'ilike', "%{$search}%");
            });
        }

        $subscriptions = $query->paginate($request->integer('per_page', 15));

        // Summary stats
        $total   = ConsultantSubscription::count();
        $active  = ConsultantSubscription::where('status', 'active')->count();
        $trials  = ConsultantSubscription::where('status', 'trial')->count();
        $revenue = ConsultantSubscription::where('status', 'active')
            ->whereNotNull('paypal_order_id')
            ->join('subscription_packages', 'consultant_subscriptions.subscription_package_id', '=', 'subscription_packages.id')
            ->selectRaw("
                SUM(CASE WHEN consultant_subscriptions.billing_cycle = 'monthly' THEN subscription_packages.monthly_price
                         WHEN consultant_subscriptions.billing_cycle = 'yearly'  THEN subscription_packages.yearly_price
                         ELSE 0 END) as total
            ")
            ->value('total') ?? 0;

        return response()->json([
            'data'  => $subscriptions->items(),
            'meta'  => [
                'current_page' => $subscriptions->currentPage(),
                'last_page'    => $subscriptions->lastPage(),
                'per_page'     => $subscriptions->perPage(),
                'total'        => $subscriptions->total(),
            ],
            'stats' => [
                'total_subscriptions' => $total,
                'active'              => $active,
                'trials'              => $trials,
                'total_revenue_cad'   => (float) $revenue,
            ],
        ]);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ConsultantSubscription;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class AdminConsultantSubscriptionsController extends Controller
{
    /**
     * GET /api/v1/admin/consultant-subscriptions
     * List consultant platform subscriptions (latest first) for expiry management.
     */
    public function index(Request $request): JsonResponse
    {
        $query = ConsultantSubscription::query()
            ->with([
                'user:id,name,email,role',
                'package:id,name,monthly_price,yearly_price',
            ])
            ->latest('id');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->whereHas('user', function ($u) use ($search) {
                $u->where('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%");
            });
        }

        if ($request->boolean('active_only')) {
            $query->where(function ($q) {
                $q->where(function ($trial) {
                    $trial->where('status', 'trial')
                        ->whereNotNull('trial_ends_at')
                        ->where('trial_ends_at', '>', now());
                })->orWhere(function ($active) {
                    $active->where('status', 'active')
                        ->where(function ($ends) {
                            $ends->whereNull('ends_at')
                                ->orWhere('ends_at', '>', now());
                        });
                });
            });
        }

        $page = $query->paginate($request->integer('per_page', 25));

        $stats = [
            'total' => ConsultantSubscription::count(),
            'active' => ConsultantSubscription::query()
                ->where('status', 'active')
                ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', now()))
                ->count(),
            'trial' => ConsultantSubscription::query()
                ->where('status', 'trial')
                ->where('trial_ends_at', '>', now())
                ->count(),
            'expired' => ConsultantSubscription::where('status', 'expired')->count(),
            'lifetime' => ConsultantSubscription::query()
                ->where('status', 'active')
                ->whereNull('ends_at')
                ->count(),
        ];

        return response()->json([
            'data' => collect($page->items())->map(fn (ConsultantSubscription $sub) => $this->format($sub))->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
            'stats' => $stats,
        ]);
    }

    /**
     * PATCH /api/v1/admin/consultant-subscriptions/{subscription}/expiry
     *
     * Modes:
     * - lifetime: ends_at = null, status = active
     * - set_date: set ends_at to a specific datetime (past = expire, future = extend)
     * - expire_now: ends_at = now(), status = expired
     * - extend_days: push ends_at forward by N days from max(now, current ends_at)
     */
    public function updateExpiry(Request $request, ConsultantSubscription $subscription): JsonResponse
    {
        $data = $request->validate([
            'mode' => ['required', Rule::in(['lifetime', 'set_date', 'expire_now', 'extend_days'])],
            'ends_at' => ['nullable', 'date', 'required_if:mode,set_date'],
            'days' => ['nullable', 'integer', 'min:1', 'max:3650', 'required_if:mode,extend_days'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $before = [
            'status' => $subscription->status,
            'ends_at' => $subscription->ends_at?->toIso8601String(),
            'trial_ends_at' => $subscription->trial_ends_at?->toIso8601String(),
        ];

        $mode = $data['mode'];

        if ($mode === 'lifetime') {
            $subscription->fill([
                'status' => 'active',
                'is_trial' => false,
                'ends_at' => null,
                'cancelled_at' => null,
            ]);
        } elseif ($mode === 'expire_now') {
            $subscription->fill([
                'status' => 'expired',
                'ends_at' => now(),
                'cancelled_at' => $subscription->cancelled_at ?? now(),
            ]);
        } elseif ($mode === 'set_date') {
            $endsAt = Carbon::parse($data['ends_at'])->endOfDay();
            if ($endsAt->isPast()) {
                $subscription->fill([
                    'status' => 'expired',
                    'ends_at' => $endsAt,
                    'cancelled_at' => $subscription->cancelled_at ?? now(),
                ]);
            } else {
                $subscription->fill([
                    'status' => 'active',
                    'is_trial' => false,
                    'ends_at' => $endsAt,
                    'cancelled_at' => null,
                    'starts_at' => $subscription->starts_at ?? now(),
                ]);
            }
        } else { // extend_days
            $days = (int) $data['days'];
            $base = $subscription->ends_at && $subscription->ends_at->isFuture()
                ? $subscription->ends_at->copy()
                : now();
            $subscription->fill([
                'status' => 'active',
                'is_trial' => false,
                'ends_at' => $base->addDays($days)->endOfDay(),
                'cancelled_at' => null,
                'starts_at' => $subscription->starts_at ?? now(),
            ]);
        }

        $subscription->save();
        $subscription->load(['user:id,name,email,role', 'package:id,name,monthly_price,yearly_price']);

        Log::info('Admin updated consultant subscription expiry', [
            'admin_id' => $request->user()?->id,
            'subscription_id' => $subscription->id,
            'user_id' => $subscription->user_id,
            'mode' => $mode,
            'note' => $data['note'] ?? null,
            'before' => $before,
            'after' => [
                'status' => $subscription->status,
                'ends_at' => $subscription->ends_at?->toIso8601String(),
            ],
            'has_stripe_subscription' => (bool) $subscription->stripe_subscription_id,
        ]);

        return response()->json([
            'message' => $this->successMessage($mode, $subscription),
            'data' => $this->format($subscription),
            'warning' => $subscription->stripe_subscription_id
                ? 'This consultant still has a Stripe subscription ID. Platform access was updated in the database only — Stripe billing may continue until cancelled in Stripe or by the consultant.'
                : null,
        ]);
    }

    private function successMessage(string $mode, ConsultantSubscription $subscription): string
    {
        return match ($mode) {
            'lifetime' => 'Subscription set to lifetime (no expiry).',
            'expire_now' => 'Subscription expired.',
            'extend_days' => 'Subscription extended to '.$subscription->ends_at?->toDateString().'.',
            default => $subscription->status === 'expired'
                ? 'Subscription expired on '.$subscription->ends_at?->toDateString().'.'
                : 'Subscription expiry set to '.$subscription->ends_at?->toDateString().'.',
        };
    }

    private function format(ConsultantSubscription $sub): array
    {
        $isLifetime = $sub->status === 'active' && $sub->ends_at === null;
        $accessActive = $sub->isCurrentlyActive();

        return [
            'id' => $sub->id,
            'status' => $sub->status,
            'is_trial' => (bool) $sub->is_trial,
            'billing_cycle' => $sub->billing_cycle,
            'starts_at' => $sub->starts_at?->toIso8601String(),
            'ends_at' => $sub->ends_at?->toIso8601String(),
            'trial_ends_at' => $sub->trial_ends_at?->toIso8601String(),
            'cancelled_at' => $sub->cancelled_at?->toIso8601String(),
            'is_lifetime' => $isLifetime,
            'access_active' => $accessActive,
            'stripe_subscription_id' => $sub->stripe_subscription_id,
            'user' => $sub->user ? [
                'id' => $sub->user->id,
                'name' => $sub->user->name,
                'email' => $sub->user->email,
                'role' => $sub->user->role,
            ] : null,
            'package' => $sub->package ? [
                'id' => $sub->package->id,
                'name' => $sub->package->name,
            ] : null,
        ];
    }
}

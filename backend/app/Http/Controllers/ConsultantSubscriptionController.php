<?php

namespace App\Http\Controllers;

use App\Models\ConsultantSubscription;
use App\Models\SubscriptionPackage;
use App\Services\Referral\ReferralLifecycleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantSubscriptionController extends Controller
{
    /**
     * GET /api/v1/consultant/subscription
     *
     * Returns the current subscription status for the authenticated consultant.
     * Automatically expires stale trial / active records.
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        $sub = ConsultantSubscription::where('user_id', $user->id)
            ->whereIn('status', ['trial', 'active', 'past_due'])
            ->latest()
            ->first();

        if ($sub) {
            if ($sub->status === 'trial' && $sub->trial_ends_at && $sub->trial_ends_at->isPast()) {
                $sub->update(['status' => 'expired']);
                $sub->refresh();
            } elseif ($sub->status === 'active' && $sub->ends_at && $sub->ends_at->isPast()) {
                $sub->update(['status' => 'expired']);
                $sub->refresh();
            }
        }

        $trialUsed = ConsultantSubscription::where('user_id', $user->id)
            ->where('is_trial', true)
            ->exists();

        $isActive = $sub && $sub->isCurrentlyActive();

        if (! $isActive) {
            $latest = ConsultantSubscription::where('user_id', $user->id)
                ->with('package')
                ->latest()
                ->first();

            return response()->json($this->statusPayload(false, $trialUsed, $latest));
        }

        return response()->json($this->statusPayload(true, $trialUsed, $sub->load('package')));
    }

    /**
     * POST /api/v1/consultant/subscription/start-trial
     *
     * Activates the free trial for the authenticated consultant.
     * Each user may only use a free trial once across all packages.
     */
    public function startTrial(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subscription_package_id' => 'required|exists:subscription_packages,id',
        ]);

        $user = $request->user();

        $trialUsed = ConsultantSubscription::where('user_id', $user->id)
            ->where('is_trial', true)
            ->exists();

        if ($trialUsed) {
            return response()->json(['message' => 'Your free trial has already been used.'], 422);
        }

        $package = SubscriptionPackage::findOrFail($data['subscription_package_id']);

        if (!$package->free_trial_days || $package->free_trial_days <= 0) {
            return response()->json(['message' => 'This package does not include a free trial.'], 422);
        }

        // Cancel any existing active/trial subscription
        ConsultantSubscription::where('user_id', $user->id)
            ->whereIn('status', ['trial', 'active'])
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        $sub = ConsultantSubscription::create([
            'user_id'                => $user->id,
            'subscription_package_id' => $package->id,
            'status'                 => 'trial',
            'is_trial'               => true,
            'trial_ends_at'          => now()->addDays($package->free_trial_days),
            'starts_at'              => now(),
            'ends_at'                => null,
            'billing_cycle'          => null,
        ]);

        app(ReferralLifecycleService::class)->onTrialStarted($user);

        return response()->json(['subscription' => $sub->load('package')], 201);
    }

    /**
     * POST /api/v1/consultant/subscription/subscribe
     *
     * Complimentary / manual paid grant. Restricted to admin and super-admin.
     * Does not create a Stripe subscription or charge a card.
     */
    public function subscribe(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subscription_package_id' => 'required|exists:subscription_packages,id',
            'billing_cycle'           => 'required|in:monthly,yearly',
        ]);

        $user    = $request->user();
        $package = SubscriptionPackage::findOrFail($data['subscription_package_id']);

        ConsultantSubscription::where('user_id', $user->id)
            ->whereIn('status', ['trial', 'active'])
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        $endsAt = $data['billing_cycle'] === 'yearly'
            ? now()->addYear()
            : now()->addMonth();

        $sub = ConsultantSubscription::create([
            'user_id'                 => $user->id,
            'subscription_package_id' => $package->id,
            'status'                  => 'active',
            'is_trial'                => false,
            'trial_ends_at'           => null,
            'starts_at'               => now(),
            'ends_at'                 => $endsAt,
            'billing_cycle'           => $data['billing_cycle'],
            'last_payment_at'         => now(),
        ]);

        return response()->json(['subscription' => $sub->load('package')], 201);
    }

    /** @return array<string, mixed> */
    private function statusPayload(bool $isActive, bool $trialUsed, ?ConsultantSubscription $sub): array
    {
        return [
            'is_active'      => $isActive,
            'trial_used'     => $trialUsed,
            'in_grace'       => $sub?->isWithinGracePeriod() ?? false,
            'grace_ends_at'  => $sub?->graceEndsAt()?->toIso8601String(),
            'subscription'   => $sub,
        ];
    }
}

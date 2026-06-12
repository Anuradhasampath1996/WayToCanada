<?php

namespace App\Services;

use App\Models\ConsultantSubscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Stripe\Invoice;
use Stripe\Subscription as StripeSubscription;

class ConsultantBillingService extends StripeService
{
    public function overview(User $user): array
    {
        $sub = $this->currentSubscription($user);
        $history = ConsultantSubscription::where('user_id', $user->id)
            ->with('package')
            ->orderByDesc('created_at')
            ->limit(12)
            ->get();

        $stripeMeta = $sub ? $this->stripeSubscriptionMeta($sub) : null;

        return [
            'subscription'      => $sub ? $this->formatSubscription($sub, $stripeMeta) : null,
            'is_active'         => $sub?->isCurrentlyActive() ?? false,
            'trial_used'        => ConsultantSubscription::where('user_id', $user->id)->where('is_trial', true)->exists(),
            'payment_history'   => $history->map(fn ($s) => $this->formatHistoryRow($s))->values(),
        ];
    }

    /** @return list<array<string, mixed>> */
    public function invoices(User $user): array
    {
        $sub = ConsultantSubscription::where('user_id', $user->id)
            ->whereNotNull('stripe_customer_id')
            ->latest()
            ->first();

        if (! $sub?->stripe_customer_id) {
            return $this->localInvoices($user);
        }

        try {
            $list = Invoice::all([
                'customer' => $sub->stripe_customer_id,
                'limit'    => 24,
            ]);

            return collect($list->data)->map(function ($inv) {
                return [
                    'id'          => $inv->id,
                    'number'      => $inv->number,
                    'amount'      => round(($inv->amount_paid ?? 0) / 100, 2),
                    'currency'    => strtoupper($inv->currency ?? 'cad'),
                    'status'      => $inv->status,
                    'paid_at'     => isset($inv->status_transitions->paid_at)
                        ? Carbon::createFromTimestamp($inv->status_transitions->paid_at)->toIso8601String()
                        : null,
                    'created_at'  => Carbon::createFromTimestamp($inv->created)->toIso8601String(),
                    'invoice_pdf' => $inv->invoice_pdf,
                    'hosted_url'  => $inv->hosted_invoice_url,
                    'source'      => 'stripe',
                ];
            })->values()->all();
        } catch (\Throwable $e) {
            Log::warning('[Billing] Stripe invoices fetch failed', ['error' => $e->getMessage()]);

            return $this->localInvoices($user);
        }
    }

    public function cancel(User $user): array
    {
        $sub = ConsultantSubscription::where('user_id', $user->id)
            ->whereIn('status', ['trial', 'active'])
            ->latest()
            ->first();

        if (! $sub) {
            throw new \RuntimeException('No active subscription to cancel.');
        }

        if ($sub->status === 'trial') {
            $sub->update(['status' => 'cancelled', 'cancelled_at' => now()]);

            return [
                'message'      => 'Your free trial has been cancelled.',
                'subscription' => $this->formatSubscription($sub->fresh()->load('package'), null),
            ];
        }

        if ($sub->stripe_subscription_id) {
            try {
                $stripeSub = StripeSubscription::update($sub->stripe_subscription_id, [
                    'cancel_at_period_end' => true,
                ]);

                $endsAt = $stripeSub->current_period_end
                    ? Carbon::createFromTimestamp($stripeSub->current_period_end)
                    : $sub->ends_at;

                $sub->update([
                    'cancelled_at' => now(),
                    'ends_at'      => $endsAt,
                ]);

                return [
                    'message'      => 'Subscription will cancel at the end of your billing period.',
                    'subscription' => $this->formatSubscription(
                        $sub->fresh()->load('package'),
                        ['cancel_at_period_end' => true, 'current_period_end' => $endsAt?->toIso8601String()],
                    ),
                ];
            } catch (\Throwable $e) {
                throw new \RuntimeException('Could not cancel subscription: ' . $e->getMessage());
            }
        }

        $sub->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        return [
            'message'      => 'Subscription cancelled.',
            'subscription' => $this->formatSubscription($sub->fresh()->load('package'), null),
        ];
    }

    private function currentSubscription(User $user): ?ConsultantSubscription
    {
        $sub = ConsultantSubscription::where('user_id', $user->id)
            ->whereIn('status', ['trial', 'active'])
            ->latest()
            ->first();

        if ($sub) {
            if ($sub->status === 'trial' && $sub->trial_ends_at?->isPast()) {
                $sub->update(['status' => 'expired']);
                $sub->refresh();
            } elseif ($sub->status === 'active' && $sub->ends_at?->isPast() && ! $sub->stripe_subscription_id) {
                $sub->update(['status' => 'expired']);
                $sub->refresh();
            }
        }

        if ($sub?->isCurrentlyActive()) {
            return $sub->load('package');
        }

        return ConsultantSubscription::where('user_id', $user->id)
            ->with('package')
            ->latest()
            ->first();
    }

    /** @return array<string, mixed>|null */
    private function stripeSubscriptionMeta(ConsultantSubscription $sub): ?array
    {
        if (! $sub->stripe_subscription_id) {
            return null;
        }

        try {
            $stripeSub = StripeSubscription::retrieve($sub->stripe_subscription_id);

            return [
                'cancel_at_period_end' => (bool) ($stripeSub->cancel_at_period_end ?? false),
                'current_period_end'   => isset($stripeSub->current_period_end)
                    ? Carbon::createFromTimestamp($stripeSub->current_period_end)->toIso8601String()
                    : null,
                'stripe_status'        => $stripeSub->status ?? null,
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    /** @param array<string, mixed>|null $stripeMeta */
    private function formatSubscription(ConsultantSubscription $sub, ?array $stripeMeta): array
    {
        $package = $sub->package;
        $price   = null;

        if ($package && $sub->billing_cycle) {
            $price = $sub->billing_cycle === 'yearly'
                ? $package->yearly_price
                : $package->monthly_price;
        }

        $cancelAtPeriodEnd = $stripeMeta['cancel_at_period_end'] ?? (
            $sub->status === 'active' && $sub->cancelled_at !== null
        );

        return [
            'id'                    => $sub->id,
            'status'                => $sub->status,
            'is_trial'              => $sub->is_trial,
            'billing_cycle'         => $sub->billing_cycle,
            'package_name'          => $package?->name,
            'package_description'   => $package?->description,
            'price'                 => $price,
            'currency'              => 'CAD',
            'starts_at'             => $sub->starts_at?->toIso8601String(),
            'ends_at'               => $sub->ends_at?->toIso8601String(),
            'trial_ends_at'         => $sub->trial_ends_at?->toIso8601String(),
            'last_payment_at'       => $sub->last_payment_at?->toIso8601String(),
            'cancelled_at'          => $sub->cancelled_at?->toIso8601String(),
            'cancel_at_period_end'  => $cancelAtPeriodEnd,
            'next_billing_at'       => $stripeMeta['current_period_end'] ?? $sub->ends_at?->toIso8601String(),
            'stripe_status'         => $stripeMeta['stripe_status'] ?? null,
            'has_stripe'            => (bool) $sub->stripe_subscription_id,
        ];
    }

    private function formatHistoryRow(ConsultantSubscription $sub): array
    {
        $package = $sub->package;
        $price   = $sub->billing_cycle === 'yearly'
            ? $package?->yearly_price
            : ($sub->billing_cycle === 'monthly' ? $package?->monthly_price : null);

        return [
            'id'            => $sub->id,
            'package_name'  => $package?->name,
            'status'        => $sub->status,
            'billing_cycle' => $sub->billing_cycle,
            'amount'        => $price,
            'currency'      => 'CAD',
            'paid_at'       => $sub->last_payment_at?->toIso8601String(),
            'starts_at'     => $sub->starts_at?->toIso8601String(),
            'ends_at'       => $sub->ends_at?->toIso8601String(),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function localInvoices(User $user): array
    {
        return ConsultantSubscription::where('user_id', $user->id)
            ->whereNotNull('last_payment_at')
            ->with('package')
            ->orderByDesc('last_payment_at')
            ->limit(24)
            ->get()
            ->map(function ($sub) {
                $price = $sub->billing_cycle === 'yearly'
                    ? $sub->package?->yearly_price
                    : $sub->package?->monthly_price;

                return [
                    'id'          => 'local-' . $sub->id,
                    'number'      => 'SUB-' . str_pad((string) $sub->id, 6, '0', STR_PAD_LEFT),
                    'amount'      => $price,
                    'currency'    => 'CAD',
                    'status'      => 'paid',
                    'paid_at'     => $sub->last_payment_at?->toIso8601String(),
                    'created_at'  => $sub->last_payment_at?->toIso8601String(),
                    'invoice_pdf' => null,
                    'hosted_url'  => null,
                    'source'      => 'local',
                ];
            })
            ->values()
            ->all();
    }
}

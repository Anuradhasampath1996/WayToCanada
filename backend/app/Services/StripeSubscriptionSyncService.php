<?php

namespace App\Services;

use App\Models\ConsultantSubscription;
use Carbon\Carbon;
use Stripe\Invoice;
use Stripe\Subscription as StripeSubscription;

class StripeSubscriptionSyncService extends StripeService
{
    public function sync(ConsultantSubscription $sub): ConsultantSubscription
    {
        if (! $sub->stripe_subscription_id) {
            throw new \RuntimeException('This subscription has no Stripe subscription ID.');
        }

        $stripeSub = StripeSubscription::retrieve([
            'id'     => $sub->stripe_subscription_id,
            'expand' => ['latest_invoice'],
        ]);

        $status = $stripeSub->status ?? '';
        $dbStatus = match (true) {
            in_array($status, ['active', 'trialing'], true) => 'active',
            in_array($status, ['canceled', 'unpaid', 'incomplete_expired', 'past_due'], true) => 'cancelled',
            default => $sub->status,
        };

        $updates = [
            'status'  => $dbStatus,
            'ends_at' => $stripeSub->current_period_end
                ? Carbon::createFromTimestamp($stripeSub->current_period_end)
                : $sub->ends_at,
        ];

        if ($dbStatus === 'cancelled' && ! $sub->cancelled_at) {
            $updates['cancelled_at'] = now();
        }

        $invoice = $stripeSub->latest_invoice;
        if (is_string($invoice)) {
            $invoice = Invoice::retrieve($invoice);
        }

        if ($invoice && ($invoice->status ?? '') === 'paid') {
            $paidAt = $invoice->status_transitions->paid_at ?? null;
            if ($paidAt) {
                $updates['last_payment_at'] = Carbon::createFromTimestamp($paidAt);
            }
        }

        $sub->update($updates);

        return $sub->fresh()->load(['user', 'package']);
    }

    /** @return array{synced: int, results: array<int, array<string, mixed>>} */
    public function syncAllActive(): array
    {
        $subs = ConsultantSubscription::where('status', 'active')
            ->whereNotNull('stripe_subscription_id')
            ->get();

        $results = [];
        foreach ($subs as $sub) {
            try {
                $fresh = $this->sync($sub);
                $results[] = [
                    'id'              => $fresh->id,
                    'user'            => $fresh->user?->email,
                    'status'          => $fresh->status,
                    'ends_at'         => $fresh->ends_at?->toIso8601String(),
                    'last_payment_at' => $fresh->last_payment_at?->toIso8601String(),
                    'success'         => true,
                ];
            } catch (\Throwable $e) {
                $results[] = [
                    'id'      => $sub->id,
                    'user'    => $sub->user?->email,
                    'success' => false,
                    'error'   => $e->getMessage(),
                ];
            }
        }

        return [
            'synced'  => count(array_filter($results, fn ($r) => $r['success'])),
            'results' => $results,
        ];
    }
}

<?php

namespace App\Services;

use App\Contracts\StripePlatformClient;
use App\Models\ConsultantSubscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class StripeDuplicateSubscriptionReportService
{
    public function __construct(
        private StripePlatformClient $stripe,
        private StripeSubscriptionStatusMapper $mapper,
    ) {}

    /**
     * Read-only report. Does not cancel Stripe subscriptions.
     *
     * @return array{duplicates: list<array<string, mixed>>, inspected_users: int}
     */
    public function report(): array
    {
        $rows = ConsultantSubscription::query()
            ->with(['user:id,name,email', 'package:id,name'])
            ->whereNotNull('stripe_subscription_id')
            ->orderBy('user_id')
            ->get()
            ->groupBy('user_id');

        $duplicates = [];
        $inspected = 0;

        foreach ($rows as $userId => $localRows) {
            $inspected++;
            $customerIds = $localRows->pluck('stripe_customer_id')->filter()->unique()->values();
            $liveFromStripe = [];

            foreach ($customerIds as $customerId) {
                try {
                    foreach ($this->stripe->listCustomerSubscriptions((string) $customerId) as $stripeSub) {
                        $type = $stripeSub->metadata->type ?? 'platform_subscription';
                        if ($type !== '' && $type !== 'platform_subscription') {
                            continue;
                        }
                        if (! $this->mapper->isLiveStripeStatus($stripeSub->status ?? null)) {
                            continue;
                        }
                        $liveFromStripe[] = $this->formatStripeRow($stripeSub, $localRows, (string) $customerId);
                    }
                } catch (\Throwable $e) {
                    Log::warning('[Billing] Duplicate report could not list Stripe subscriptions', [
                        'user_id' => $userId,
                        'customer' => $customerId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            $liveLocal = $localRows->filter(fn ($r) => in_array($r->status, ['active', 'past_due', 'trial'], true)
                && $r->stripe_subscription_id);

            $needsReview = count($liveFromStripe) > 1 || $liveLocal->pluck('stripe_subscription_id')->unique()->count() > 1;
            if (! $needsReview) {
                continue;
            }

            /** @var User|null $user */
            $user = $localRows->first()?->user;
            $duplicates[] = [
                'user_id' => (int) $userId,
                'name'    => $user?->name,
                'email'   => $user?->email,
                'stripe_customer_ids' => $customerIds->all(),
                'live_stripe_subscriptions' => $liveFromStripe,
                'local_rows' => $localRows->map(fn ($row) => [
                    'id' => $row->id,
                    'status' => $row->status,
                    'package' => $row->package?->name,
                    'stripe_subscription_id' => $row->stripe_subscription_id,
                    'stripe_customer_id' => $row->stripe_customer_id,
                    'ends_at' => $row->ends_at?->toIso8601String(),
                ])->values()->all(),
            ];
        }

        return [
            'duplicates' => $duplicates,
            'inspected_users' => $inspected,
            'auto_cancelled' => false,
            'note' => 'Inspect each live Stripe subscription before taking a billing action. This report never cancels subscriptions.',
        ];
    }

    /**
     * @param \Illuminate\Support\Collection<int, ConsultantSubscription> $localRows
     * @return array<string, mixed>
     */
    private function formatStripeRow(object $stripeSub, $localRows, string $customerId): array
    {
        $local = $localRows->firstWhere('stripe_subscription_id', $stripeSub->id);

        return [
            'stripe_subscription_id' => $stripeSub->id,
            'stripe_customer_id'     => $customerId,
            'stripe_status'          => $stripeSub->status ?? null,
            'price_id'               => $stripeSub->items->data[0]->price->id ?? null,
            'current_period_end'     => isset($stripeSub->current_period_end)
                ? Carbon::createFromTimestamp((int) $stripeSub->current_period_end)->toIso8601String()
                : null,
            'local_subscription_id'  => $local?->id,
            'local_status'           => $local?->status,
            'local_package'          => $local?->package?->name,
        ];
    }
}

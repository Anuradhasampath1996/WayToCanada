<?php

namespace App\Services;

use App\Contracts\StripePlatformClient;
use App\Models\ConsultantSubscription;
use App\Models\ConsultantSubscriptionPlanChange;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Carbon\Carbon;
use RuntimeException;

class ConsultantPlanChangeService
{
    public function __construct(
        private StripePlatformClient $stripe,
        private StripePlatformSubscriptionGuard $guard,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function preview(User $user, int $packageId, string $cycle): array
    {
        [$sub, $package, $stripeSub, $fromPriceId, $toPriceId, $behavior] = $this->resolveChange($user, $packageId, $cycle);

        $invoice = $this->stripe->previewInvoice([
            'customer'     => $sub->stripe_customer_id,
            'subscription' => $sub->stripe_subscription_id,
            'subscription_details' => [
                'items' => [[
                    'id'    => $stripeSub->items->data[0]->id ?? null,
                    'price' => $toPriceId,
                ]],
                'proration_behavior' => $behavior,
            ],
        ]);

        $immediate = round(((int) ($invoice->amount_due ?? 0)) / 100, 2);
        $tax = round(((int) ($invoice->tax ?? 0)) / 100, 2);
        $credit = $this->creditFromPreview($invoice);
        $periodEnd = isset($invoice->period_end)
            ? Carbon::createFromTimestamp((int) $invoice->period_end)
            : ($stripeSub->current_period_end ? Carbon::createFromTimestamp((int) $stripeSub->current_period_end) : $sub->ends_at);

        $newRecurring = $cycle === 'yearly' ? (float) $package->yearly_price : (float) $package->monthly_price;

        return [
            'current_plan' => [
                'package_id'    => $sub->subscription_package_id,
                'package_name'  => $sub->package?->name,
                'billing_cycle' => $sub->billing_cycle,
                'stripe_price'  => $fromPriceId,
                'recurring'     => $sub->billing_cycle === 'yearly'
                    ? (float) $sub->package?->yearly_price
                    : (float) $sub->package?->monthly_price,
            ],
            'new_plan' => [
                'package_id'    => $package->id,
                'package_name'  => $package->name,
                'billing_cycle' => $cycle,
                'stripe_price'  => $toPriceId,
                'recurring'     => $newRecurring,
            ],
            'credit_amount'        => $credit,
            'immediate_charge'     => max(0, $immediate),
            'tax_amount'           => $tax,
            'currency'             => strtoupper((string) ($invoice->currency ?? 'cad')),
            'next_billing_at'      => $periodEnd?->toIso8601String(),
            'proration_behavior'   => $behavior,
            'payment_behavior'     => 'error_if_incomplete',
            'cycle_change'         => $sub->billing_cycle !== $cycle,
        ];
    }

    /**
     * @param array<string, mixed>|null $confirmedPreview
     * @return array<string, mixed>
     */
    public function confirm(User $user, int $packageId, string $cycle, ?array $confirmedPreview = null): array
    {
        $preview = $this->preview($user, $packageId, $cycle);
        if ($confirmedPreview && isset($confirmedPreview['immediate_charge'])
            && (float) $confirmedPreview['immediate_charge'] !== (float) $preview['immediate_charge']) {
            throw new RuntimeException('The quoted amount changed. Please review the new preview and confirm again.');
        }

        [$sub, $package, $stripeSub, $fromPriceId, $toPriceId, $behavior] = $this->resolveChange($user, $packageId, $cycle);

        $itemId = $stripeSub->items->data[0]->id ?? null;
        if (! $itemId) {
            throw new RuntimeException('Stripe subscription item is missing.');
        }

        try {
            $updated = $this->stripe->updateSubscription($sub->stripe_subscription_id, [
                'items' => [[
                    'id'    => $itemId,
                    'price' => $toPriceId,
                ]],
                'proration_behavior' => $behavior,
                'payment_behavior'   => 'error_if_incomplete',
            ]);
        } catch (\Throwable $e) {
            ConsultantSubscriptionPlanChange::create([
                'consultant_subscription_id' => $sub->id,
                'user_id'                    => $user->id,
                'from_package_id'            => $sub->subscription_package_id,
                'to_package_id'              => $package->id,
                'from_billing_cycle'         => $sub->billing_cycle,
                'to_billing_cycle'           => $cycle,
                'from_stripe_price_id'       => $fromPriceId,
                'to_stripe_price_id'         => $toPriceId,
                'proration_behavior'         => $behavior,
                'immediate_charge'           => $preview['immediate_charge'],
                'credit_amount'              => $preview['credit_amount'],
                'tax_amount'                 => $preview['tax_amount'],
                'result'                     => 'failed',
                'error_message'              => $e->getMessage(),
                'preview'                    => $preview,
            ]);

            throw new RuntimeException('Plan change was not applied. Your current subscription is unchanged. '.$e->getMessage());
        }

        $endsAt = isset($updated->current_period_end)
            ? Carbon::createFromTimestamp((int) $updated->current_period_end)
            : $sub->ends_at;

        $sub->update([
            'subscription_package_id' => $package->id,
            'billing_cycle'           => $cycle,
            'ends_at'                 => $endsAt,
            'status'                  => app(StripeSubscriptionStatusMapper::class)->toLocal($updated->status ?? 'active', $sub->status),
        ]);

        $change = ConsultantSubscriptionPlanChange::create([
            'consultant_subscription_id' => $sub->id,
            'user_id'                    => $user->id,
            'from_package_id'            => $preview['current_plan']['package_id'],
            'to_package_id'              => $package->id,
            'from_billing_cycle'         => $preview['current_plan']['billing_cycle'],
            'to_billing_cycle'           => $cycle,
            'from_stripe_price_id'       => $fromPriceId,
            'to_stripe_price_id'         => $toPriceId,
            'proration_behavior'         => $behavior,
            'immediate_charge'           => $preview['immediate_charge'],
            'credit_amount'              => $preview['credit_amount'],
            'tax_amount'                 => $preview['tax_amount'],
            'result'                     => 'succeeded',
            'preview'                    => $preview,
        ]);

        return [
            'message'      => 'Your plan has been updated.',
            'subscription' => $sub->fresh()->load('package'),
            'change'       => $change,
            'preview'      => $preview,
        ];
    }

    /**
     * @return array{0: ConsultantSubscription, 1: SubscriptionPackage, 2: object, 3: string, 4: string, 5: string}
     */
    private function resolveChange(User $user, int $packageId, string $cycle): array
    {
        $sub = $this->guard->livePaidSubscription($user);
        if (! $sub || ! $sub->stripe_subscription_id || ! $sub->stripe_customer_id) {
            throw new RuntimeException('No live Stripe subscription to update. Start a paid plan with Checkout first.');
        }

        $package = SubscriptionPackage::findOrFail($packageId);
        if ($sub->subscription_package_id === $package->id && $sub->billing_cycle === $cycle) {
            throw new RuntimeException('You are already on this plan.');
        }

        $stripeSub = $this->stripe->retrieveSubscription($sub->stripe_subscription_id, [
            'expand' => ['items.data.price'],
        ]);
        $fromPriceId = (string) ($stripeSub->items->data[0]->price->id ?? '');
        $toPriceId = $this->priceId($package, $cycle);
        $behavior = $this->prorationBehavior($sub, $package, $cycle);

        $sub->loadMissing('package');

        return [$sub, $package, $stripeSub, $fromPriceId, $toPriceId, $behavior];
    }

    private function prorationBehavior(ConsultantSubscription $sub, SubscriptionPackage $package, string $cycle): string
    {
        if ($sub->billing_cycle !== $cycle) {
            return 'always_invoice';
        }

        $old = $sub->billing_cycle === 'yearly'
            ? (float) $sub->package?->yearly_price
            : (float) $sub->package?->monthly_price;
        $new = $cycle === 'yearly' ? (float) $package->yearly_price : (float) $package->monthly_price;

        return $new > $old ? 'always_invoice' : 'create_prorations';
    }

    private function priceId(SubscriptionPackage $package, string $cycle): string
    {
        $field = $cycle === 'yearly' ? 'stripe_yearly_price_id' : 'stripe_monthly_price_id';
        if ($package->{$field}) {
            return (string) $package->{$field};
        }

        return app(StripeSubscriptionService::class)->ensurePrice($package, $cycle);
    }

    private function creditFromPreview(object $invoice): float
    {
        $credit = 0.0;
        foreach ($invoice->lines->data ?? [] as $line) {
            $amount = (int) ($line->amount ?? 0);
            if ($amount < 0) {
                $credit += abs($amount) / 100;
            }
        }

        return round($credit, 2);
    }
}

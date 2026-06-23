<?php

namespace App\Services;

use App\Models\SubscriptionPackage;
use Stripe\Checkout\Session;
use Stripe\Price;
use Stripe\Product;

class StripeSubscriptionService extends StripeService
{
    /**
     * Create or reuse a Stripe Product for the package.
     */
    public function ensureProduct(SubscriptionPackage $package): string
    {
        if ($package->stripe_product_id) {
            return $package->stripe_product_id;
        }

        $product = Product::create([
            'name'        => 'RCICMASTER — ' . $package->name,
            'description' => $package->description ?? $package->name,
            'metadata'    => ['package_id' => (string) $package->id],
        ]);

        $package->update(['stripe_product_id' => $product->id]);

        return $product->id;
    }

    /**
     * Create or reuse a recurring Stripe Price for package + billing cycle.
     */
    public function ensurePrice(SubscriptionPackage $package, string $cycle): string
    {
        $priceField = $cycle === 'yearly' ? 'stripe_yearly_price_id' : 'stripe_monthly_price_id';

        if ($package->{$priceField}) {
            return $package->{$priceField};
        }

        $amount = $cycle === 'yearly' ? $package->yearly_price : $package->monthly_price;
        if (! $amount || $amount <= 0) {
            throw new \RuntimeException('This package has no price configured for the selected billing cycle.');
        }

        $productId = $this->ensureProduct($package);

        $price = Price::create([
            'product'    => $productId,
            'unit_amount' => (int) round($amount * 100),
            'currency'   => 'cad',
            'recurring'  => [
                'interval' => $cycle === 'yearly' ? 'year' : 'month',
            ],
            'metadata' => [
                'package_id'    => (string) $package->id,
                'billing_cycle' => $cycle,
            ],
        ]);

        $package->update([$priceField => $price->id]);

        return $price->id;
    }

    /**
     * Create a Stripe Checkout Session for subscription purchase.
     *
     * @return array{session_id: string, url: string}
     */
    public function createCheckoutSession(
        SubscriptionPackage $package,
        string $cycle,
        int $userId,
        string $userEmail,
        string $successUrl,
        string $cancelUrl,
        ?string $provinceCode = null,
        ?array $taxRateIds = null,
        ?string $billingCountry = 'CA',
    ): array {
        $priceId = $this->ensurePrice($package, $cycle);

        $sessionParams = [
            'mode'                => 'subscription',
            'line_items'          => [['price' => $priceId, 'quantity' => 1]],
            'success_url'         => $successUrl,
            'cancel_url'          => $cancelUrl,
            'client_reference_id' => (string) $userId,
            'metadata'            => [
                'subscription_package_id' => (string) $package->id,
                'billing_cycle'           => $cycle,
                'user_id'                 => (string) $userId,
                'province'                => $provinceCode ?? '',
                'billing_country'         => $billingCountry ?? 'CA',
            ],
            'subscription_data' => [
                'metadata' => [
                    'subscription_package_id' => (string) $package->id,
                    'billing_cycle'           => $cycle,
                    'user_id'                 => (string) $userId,
                    'province'                => $provinceCode ?? '',
                    'billing_country'         => $billingCountry ?? 'CA',
                ],
            ],
        ];

        if ($taxRateIds) {
            $sessionParams['subscription_data']['default_tax_rates'] = $taxRateIds;
        }

        $testClock = new StripeTestClockService();
        if ($testClock->getTestClockId()) {
            $sessionParams['customer'] = $testClock->ensureCustomer($userEmail, $userId);
        } else {
            $sessionParams['customer_email'] = $userEmail;
        }

        $session = Session::create($sessionParams);

        return [
            'session_id' => $session->id,
            'url'        => $session->url,
        ];
    }
}

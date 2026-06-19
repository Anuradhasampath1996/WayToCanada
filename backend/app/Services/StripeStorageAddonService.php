<?php

namespace App\Services;

use App\Models\StorageAddonPackage;
use Stripe\Checkout\Session;
use Stripe\Price;
use Stripe\Product;

class StripeStorageAddonService extends StripeService
{
    public function ensureProduct(StorageAddonPackage $package): string
    {
        if ($package->stripe_product_id) {
            return $package->stripe_product_id;
        }

        $product = Product::create([
            'name'        => 'RCICMASTER — Storage +' . $package->extra_gb . ' GB',
            'description' => $package->description ?? $package->name,
            'metadata'    => ['storage_addon_package_id' => (string) $package->id],
        ]);

        $package->update(['stripe_product_id' => $product->id]);

        return $product->id;
    }

    public function ensurePrice(StorageAddonPackage $package, string $cycle): string
    {
        $priceField = $cycle === 'yearly' ? 'stripe_yearly_price_id' : 'stripe_monthly_price_id';

        if ($package->{$priceField}) {
            return $package->{$priceField};
        }

        $amount = $cycle === 'yearly' ? $package->yearly_price : $package->monthly_price;
        if (! $amount || $amount <= 0) {
            throw new \RuntimeException('This storage package has no price for the selected billing cycle.');
        }

        $productId = $this->ensureProduct($package);

        $price = Price::create([
            'product'     => $productId,
            'unit_amount' => (int) round($amount * 100),
            'currency'    => 'cad',
            'recurring'   => [
                'interval' => $cycle === 'yearly' ? 'year' : 'month',
            ],
            'metadata' => [
                'storage_addon_package_id' => (string) $package->id,
                'billing_cycle'            => $cycle,
            ],
        ]);

        $package->update([$priceField => $price->id]);

        return $price->id;
    }

    /**
     * @return array{session_id: string, url: string}
     */
    public function createCheckoutSession(
        StorageAddonPackage $package,
        string $cycle,
        int $userId,
        string $userEmail,
        string $successUrl,
        string $cancelUrl,
        ?string $provinceCode = null,
        ?array $taxRateIds = null,
    ): array {
        $priceId = $this->ensurePrice($package, $cycle);

        $sessionParams = [
            'mode'                => 'subscription',
            'line_items'          => [['price' => $priceId, 'quantity' => 1]],
            'success_url'         => $successUrl,
            'cancel_url'          => $cancelUrl,
            'client_reference_id' => (string) $userId,
            'metadata'            => [
                'type'                     => 'storage_addon',
                'storage_addon_package_id' => (string) $package->id,
                'billing_cycle'            => $cycle,
                'user_id'                  => (string) $userId,
                'province'                 => $provinceCode ?? '',
            ],
            'subscription_data' => [
                'metadata' => [
                    'type'                     => 'storage_addon',
                    'storage_addon_package_id' => (string) $package->id,
                    'billing_cycle'            => $cycle,
                    'user_id'                  => (string) $userId,
                    'province'                 => $provinceCode ?? '',
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

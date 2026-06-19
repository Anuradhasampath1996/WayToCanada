<?php

namespace App\Services;

use App\Models\MarketingService;
use Stripe\Checkout\Session;
use Stripe\Price;
use Stripe\Product;

class StripeMarketingService extends StripeService
{
    public function ensureProduct(MarketingService $service): string
    {
        if ($service->stripe_product_id) {
            return $service->stripe_product_id;
        }

        $product = Product::create([
            'name'        => 'Way To Canada — ' . $service->name,
            'description' => $service->tagline ?? $service->summary,
            'metadata'    => ['marketing_service_id' => (string) $service->id],
        ]);

        $service->update(['stripe_product_id' => $product->id]);

        return $product->id;
    }

    public function ensurePrice(MarketingService $service): string
    {
        if ($service->stripe_price_id) {
            return $service->stripe_price_id;
        }

        if (! $service->price || $service->price <= 0) {
            throw new \RuntimeException('This marketing service has no price configured.');
        }

        $productId = $this->ensureProduct($service);

        $priceData = [
            'product'     => $productId,
            'unit_amount' => (int) round((float) $service->price * 100),
            'currency'    => 'cad',
            'metadata'    => [
                'marketing_service_id' => (string) $service->id,
                'billing_type'         => $service->billing_type,
            ],
        ];

        if ($service->billing_type === MarketingService::BILLING_MONTHLY) {
            $priceData['recurring'] = ['interval' => 'month'];
        }

        $price = Price::create($priceData);
        $service->update(['stripe_price_id' => $price->id]);

        return $price->id;
    }

    /**
     * @param  list<string>|null  $taxRateIds
     * @return array{session_id: string, url: string}
     */
    public function createCheckoutSession(
        MarketingService $service,
        int $userId,
        string $userEmail,
        string $successUrl,
        string $cancelUrl,
        ?string $provinceCode = null,
        ?array $taxRateIds = null,
    ): array {
        $priceId = $this->ensurePrice($service);
        $mode    = $service->billing_type === MarketingService::BILLING_MONTHLY ? 'subscription' : 'payment';

        $lineItem = ['price' => $priceId, 'quantity' => 1];
        if ($taxRateIds) {
            $lineItem['tax_rates'] = $taxRateIds;
        }

        $session = Session::create([
            'mode'                => $mode,
            'line_items'          => [$lineItem],
            'success_url'         => $successUrl,
            'cancel_url'          => $cancelUrl,
            'client_reference_id' => (string) $userId,
            'customer_email'      => $userEmail,
            'metadata'            => [
                'type'                 => 'marketing_service',
                'marketing_service_id' => (string) $service->id,
                'billing_type'         => $service->billing_type,
                'user_id'              => (string) $userId,
                'province'             => $provinceCode ?? '',
            ],
        ]);

        return [
            'session_id' => $session->id,
            'url'        => $session->url,
        ];
    }
}

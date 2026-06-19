<?php

namespace App\Services;

use App\Models\PaymentGatewaySetting;
use App\Models\SubscriptionPackage;
use Illuminate\Support\Facades\Http;

/**
 * Wraps the PayPal Subscriptions / Billing Plans REST API v1.
 *
 * Flow:
 *  1. ensureProduct()        – create (or reuse) a PayPal Product per package
 *  2. ensurePlan()           – create (or reuse) a PayPal Billing Plan per package+cycle
 *  3. createSubscription()   – create a PayPal Subscription → returns approval_url
 *  4. getSubscription()      – poll / verify status after consultant returns from PayPal
 *  5. cancelSubscription()   – cancel a running subscription
 */
class PayPalSubscriptionService
{
    private string $baseUrl;
    private string $clientId;
    private string $secret;

    /**
     * @throws \RuntimeException when PayPal is not configured / not active.
     */
    public function __construct()
    {
        /** @var PaymentGatewaySetting|null $setting */
        $setting = PaymentGatewaySetting::where('gateway', 'paypal')
            ->where('is_active', true)
            ->first();

        if (! $setting) {
            throw new \RuntimeException('PayPal gateway is not configured or not active.');
        }

        $clientId = PaymentGatewaySetting::decryptKey($setting->publishable_key);
        $secret   = PaymentGatewaySetting::decryptKey($setting->secret_key);

        if (! $clientId || ! $secret) {
            throw new \RuntimeException('PayPal Client ID or Secret is missing.');
        }

        $this->clientId = $clientId;
        $this->secret   = $secret;
        $this->baseUrl  = $setting->mode === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }

    public function getClientId(): string { return $this->clientId; }

    // ─────────────────────────────────────────────────────────────────────────
    // OAuth2
    // ─────────────────────────────────────────────────────────────────────────

    private function getAccessToken(): string
    {
        $response = Http::withBasicAuth($this->clientId, $this->secret)
            ->asForm()
            ->post("{$this->baseUrl}/v1/oauth2/token", ['grant_type' => 'client_credentials']);

        if (! $response->successful()) {
            throw new \RuntimeException('PayPal auth failed: ' . $response->body());
        }

        return $response->json('access_token');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Products API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create (or reuse) a PayPal Product for the given subscription package.
     * The product_id is cached on the package row.
     */
    public function ensureProduct(SubscriptionPackage $package): string
    {
        if ($package->paypal_product_id) {
            return $package->paypal_product_id;
        }

        $token = $this->getAccessToken();

        $response = Http::withToken($token)->post("{$this->baseUrl}/v1/catalogs/products", [
            'name'        => 'RCICMASTER — ' . $package->name,
            'description' => $package->description ?? $package->name,
            'type'        => 'SERVICE',
            'category'    => 'SOFTWARE',
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Failed to create PayPal product: ' . $response->body());
        }

        $productId = $response->json('id');
        $package->update(['paypal_product_id' => $productId]);

        return $productId;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Plans API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create (or reuse) a PayPal Billing Plan for a given package + billing cycle.
     * The plan_id is cached on the package row.
     */
    public function ensurePlan(SubscriptionPackage $package, string $cycle): string
    {
        $planField = $cycle === 'yearly' ? 'paypal_yearly_plan_id' : 'paypal_monthly_plan_id';

        if ($package->{$planField}) {
            return $package->{$planField};
        }

        $productId = $this->ensureProduct($package);
        $price     = $cycle === 'yearly' ? $package->yearly_price : $package->monthly_price;

        if (! $price || $price <= 0) {
            throw new \RuntimeException("No {$cycle} price set for package '{$package->name}'.");
        }

        $token = $this->getAccessToken();

        $intervalUnit  = $cycle === 'yearly' ? 'YEAR' : 'MONTH';
        $intervalCount = 1;

        $response = Http::withToken($token)->post("{$this->baseUrl}/v1/billing/plans", [
            'product_id' => $productId,
            'name'       => $package->name . ' — ' . ucfirst($cycle),
            'status'     => 'ACTIVE',
            'billing_cycles' => [
                [
                    'frequency'      => [
                        'interval_unit'  => $intervalUnit,
                        'interval_count' => $intervalCount,
                    ],
                    'tenure_type'    => 'REGULAR',
                    'sequence'       => 1,
                    'total_cycles'   => 0, // 0 = infinite / until cancelled
                    'pricing_scheme' => [
                        'fixed_price' => [
                            'value'         => number_format((float) $price, 2, '.', ''),
                            'currency_code' => 'CAD',
                        ],
                    ],
                ],
            ],
            'payment_preferences' => [
                'auto_bill_outstanding'     => true,
                'setup_fee_failure_action'  => 'CONTINUE',
                'payment_failure_threshold' => 3,
            ],
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Failed to create PayPal plan: ' . $response->body());
        }

        $planId = $response->json('id');
        $package->update([$planField => $planId]);

        return $planId;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Subscriptions API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create a PayPal Subscription for a plan.
     * Returns the full API response including the approval_url (rel="approve").
     *
     * @return array{id: string, status: string, links: array<array{href: string, rel: string}>}
     */
    public function createSubscription(string $planId, string $returnUrl, string $cancelUrl): array
    {
        $token = $this->getAccessToken();

        $response = Http::withToken($token)->post("{$this->baseUrl}/v1/billing/subscriptions", [
            'plan_id'             => $planId,
            'application_context' => [
                'brand_name'          => 'RCICMASTER',
                'locale'              => 'en-CA',
                'shipping_preference' => 'NO_SHIPPING',
                'user_action'         => 'SUBSCRIBE_NOW',
                'return_url'          => $returnUrl,
                'cancel_url'          => $cancelUrl,
            ],
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Failed to create PayPal subscription: ' . $response->body());
        }

        return $response->json();
    }

    /**
     * Fetch a PayPal Subscription by ID.
     */
    public function getSubscription(string $subscriptionId): array
    {
        $token    = $this->getAccessToken();
        $response = Http::withToken($token)
            ->get("{$this->baseUrl}/v1/billing/subscriptions/{$subscriptionId}");

        if (! $response->successful()) {
            throw new \RuntimeException('Failed to fetch PayPal subscription: ' . $response->body());
        }

        return $response->json();
    }

    /**
     * Cancel a PayPal Subscription.
     */
    public function cancelSubscription(string $subscriptionId, string $reason = 'Cancelled by user'): void
    {
        $token    = $this->getAccessToken();
        $response = Http::withToken($token)
            ->post("{$this->baseUrl}/v1/billing/subscriptions/{$subscriptionId}/cancel", [
                'reason' => $reason,
            ]);

        // 204 No Content = success; 422 = already cancelled (both are fine)
        if ($response->status() >= 500) {
            throw new \RuntimeException('Failed to cancel PayPal subscription: ' . $response->body());
        }
    }

    /**
     * Verify a PayPal Webhook signature.
     * Returns true if the event is authentic.
     */
    public function verifyWebhookSignature(
        string $webhookId,
        array  $headers,
        string $rawBody
    ): bool {
        $token = $this->getAccessToken();

        $response = Http::withToken($token)->post(
            "{$this->baseUrl}/v1/notifications/verify-webhook-signature",
            [
                'auth_algo'         => $headers['PAYPAL-AUTH-ALGO']         ?? '',
                'cert_url'          => $headers['PAYPAL-CERT-URL']          ?? '',
                'transmission_id'   => $headers['PAYPAL-TRANSMISSION-ID']   ?? '',
                'transmission_sig'  => $headers['PAYPAL-TRANSMISSION-SIG']  ?? '',
                'transmission_time' => $headers['PAYPAL-TRANSMISSION-TIME'] ?? '',
                'webhook_id'        => $webhookId,
                'webhook_event'     => json_decode($rawBody, true),
            ]
        );

        if (! $response->successful()) {
            return false;
        }

        return $response->json('verification_status') === 'SUCCESS';
    }
}

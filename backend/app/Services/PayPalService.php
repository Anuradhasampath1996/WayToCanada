<?php

namespace App\Services;

use App\Models\PaymentGatewaySetting;
use Illuminate\Support\Facades\Http;

class PayPalService
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
            throw new \RuntimeException('PayPal gateway is not configured or is not active. Please enable it in the Admin → Payment Gateways panel.');
        }

        $clientId = PaymentGatewaySetting::decryptKey($setting->publishable_key);
        $secret   = PaymentGatewaySetting::decryptKey($setting->secret_key);

        if (! $clientId || ! $secret) {
            throw new \RuntimeException('PayPal Client ID or Secret is missing. Please configure it in the Admin → Payment Gateways panel.');
        }

        $this->clientId = $clientId;
        $this->secret   = $secret;
        $this->baseUrl  = $setting->mode === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }

    /** Returns the public Client ID (safe to send to the browser). */
    public function getClientId(): string
    {
        return $this->clientId;
    }

    /** Returns "production" or "sandbox" so the frontend can load the correct PayPal JS SDK. */
    public function getEnvironment(): string
    {
        return str_contains($this->baseUrl, 'sandbox') ? 'sandbox' : 'production';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OAuth 2.0 Client-Credentials token
    // ─────────────────────────────────────────────────────────────────────────

    private function getAccessToken(): string
    {
        $response = Http::withBasicAuth($this->clientId, $this->secret)
            ->asForm()
            ->post("{$this->baseUrl}/v1/oauth2/token", ['grant_type' => 'client_credentials']);

        if (! $response->successful()) {
            throw new \RuntimeException('PayPal authentication failed: ' . $response->body());
        }

        return $response->json('access_token');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Orders API v2
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create a PayPal Order (intent=CAPTURE).
     *
     * @return array{id: string, status: string, links: array}
     */
    public function createOrder(float $amount, string $currency, string $description): array
    {
        $token = $this->getAccessToken();

        $response = Http::withToken($token)
            ->post("{$this->baseUrl}/v2/checkout/orders", [
                'intent'         => 'CAPTURE',
                'purchase_units' => [
                    [
                        'amount'      => [
                            'currency_code' => strtoupper($currency),
                            'value'         => number_format($amount, 2, '.', ''),
                        ],
                        'description' => $description,
                    ],
                ],
            ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Failed to create PayPal order: ' . $response->body());
        }

        return $response->json();
    }

    /**
     * Capture an approved PayPal Order.
     *
     * @return array{id: string, status: string, purchase_units: array}
     */
    public function captureOrder(string $orderId): array
    {
        $token = $this->getAccessToken();

        $response = Http::withToken($token)
            ->post("{$this->baseUrl}/v2/checkout/orders/{$orderId}/capture", new \stdClass());

        if (! $response->successful()) {
            throw new \RuntimeException('Failed to capture PayPal order: ' . $response->body());
        }

        return $response->json();
    }

    /**
     * Fetch order details (to verify status before capturing).
     */
    public function getOrder(string $orderId): array
    {
        $token = $this->getAccessToken();

        $response = Http::withToken($token)
            ->get("{$this->baseUrl}/v2/checkout/orders/{$orderId}");

        if (! $response->successful()) {
            throw new \RuntimeException('Failed to fetch PayPal order: ' . $response->body());
        }

        return $response->json();
    }
}

<?php

namespace App\Services;

use App\Models\PaymentGatewaySetting;
use Stripe\Stripe;

class StripeService
{
    protected PaymentGatewaySetting $setting;

    protected string $publishableKey;

    protected string $secretKey;

    /**
     * @throws \RuntimeException when Stripe is not configured / not active.
     */
    public function __construct()
    {
        /** @var PaymentGatewaySetting|null $setting */
        $setting = PaymentGatewaySetting::where('gateway', 'stripe')
            ->where('is_active', true)
            ->first();

        if (! $setting) {
            throw new \RuntimeException('Stripe gateway is not configured or is not active. Please enable it in Admin → Payment Gateway.');
        }

        $publishable = PaymentGatewaySetting::decryptKey($setting->publishable_key);
        $secret      = PaymentGatewaySetting::decryptKey($setting->secret_key);

        if (! $publishable || ! $secret) {
            throw new \RuntimeException('Stripe publishable or secret key is missing. Please configure them in Admin → Payment Gateway.');
        }

        $this->setting         = $setting;
        $this->publishableKey = $publishable;
        $this->secretKey       = $secret;

        Stripe::setApiKey($this->secretKey);
    }

    public function getPublishableKey(): string
    {
        return $this->publishableKey;
    }

    public function getWebhookSecret(): ?string
    {
        $id = $this->setting->webhook_id;
        return $id ? PaymentGatewaySetting::decryptKey($id) ?? $id : null;
    }

    public function isTestMode(): bool
    {
        return $this->setting->mode === 'test';
    }
}

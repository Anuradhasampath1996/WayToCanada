<?php

namespace App\Services\Stripe;

use App\Contracts\StripePlatformClient;
use App\Services\StripeService;
use Stripe\BillingPortal\Session as PortalSession;
use Stripe\Checkout\Session as CheckoutSession;
use Stripe\Customer;
use Stripe\Invoice;
use Stripe\Subscription;

class LiveStripePlatformClient implements StripePlatformClient
{
    public function __construct()
    {
        new StripeService();
    }

    public function createCheckoutSession(array $params): object
    {
        return CheckoutSession::create($params);
    }

    public function retrieveCheckoutSession(string $id, array $expand = []): object
    {
        return CheckoutSession::retrieve(['id' => $id, 'expand' => $expand]);
    }

    public function retrieveSubscription(string $id, array $params = []): object
    {
        return Subscription::retrieve(array_merge(['id' => $id], $params));
    }

    public function updateSubscription(string $id, array $params): object
    {
        return Subscription::update($id, $params);
    }

    public function previewInvoice(array $params): object
    {
        if (method_exists(Invoice::class, 'createPreview')) {
            return Invoice::createPreview($params);
        }

        return Invoice::upcoming($params);
    }

    public function createBillingPortalSession(array $params): object
    {
        return PortalSession::create($params);
    }

    public function listCustomerSubscriptions(string $customerId): array
    {
        $list = Subscription::all([
            'customer' => $customerId,
            'status'   => 'all',
            'limit'    => 100,
        ]);

        return $list->data ?? [];
    }

    public function createCustomer(string $email, int $userId): object
    {
        return Customer::create([
            'email'    => $email,
            'metadata' => ['user_id' => (string) $userId, 'type' => 'platform_subscription'],
        ]);
    }
}

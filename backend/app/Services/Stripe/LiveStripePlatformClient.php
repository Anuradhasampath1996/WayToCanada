<?php

namespace App\Services\Stripe;

use App\Contracts\StripePlatformClient;
use App\Services\StripeService;
use Stripe\BillingPortal\Session as PortalSession;
use Stripe\Charge;
use Stripe\Checkout\Session as CheckoutSession;
use Stripe\Customer;
use Stripe\Invoice;
use Stripe\InvoiceItem;
use Stripe\PaymentIntent;
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

    public function createInvoiceCreditItem(string $customerId, string $invoiceId, float $amountCad, string $description): object
    {
        $cents = (int) round($amountCad * 100);
        if ($cents <= 0) {
            throw new \InvalidArgumentException('Wallet credit must be greater than zero.');
        }

        return InvoiceItem::create([
            'customer' => $customerId,
            'invoice' => $invoiceId,
            'amount' => -$cents,
            'currency' => 'cad',
            'description' => $description,
            'tax_behavior' => 'exclusive',
            'metadata' => [
                'type' => 'consultant_wallet_credit',
                'isolated' => 'platform_renewal_only',
            ],
        ]);
    }

    public function invoiceIdForPaymentIntent(string $paymentIntentId): ?string
    {
        $intent = PaymentIntent::retrieve($paymentIntentId);
        $invoice = $intent->invoice ?? null;
        if (is_string($invoice) && str_starts_with($invoice, 'in_')) {
            return $invoice;
        }
        if (is_object($invoice) && isset($invoice->id)) {
            return (string) $invoice->id;
        }

        $latestCharge = $intent->latest_charge ?? null;
        $chargeId = is_object($latestCharge) ? ($latestCharge->id ?? null) : $latestCharge;
        if (! is_string($chargeId) || $chargeId === '') {
            return null;
        }

        $charge = Charge::retrieve($chargeId);
        $chargeInvoice = $charge->invoice ?? null;
        if (is_string($chargeInvoice) && str_starts_with($chargeInvoice, 'in_')) {
            return $chargeInvoice;
        }

        return is_object($chargeInvoice) ? ($chargeInvoice->id ?? null) : null;
    }
}

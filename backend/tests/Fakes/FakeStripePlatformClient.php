<?php

namespace Tests\Fakes;

use App\Contracts\StripePlatformClient;
use RuntimeException;

class FakeStripePlatformClient implements StripePlatformClient
{
    /** @var array<string, object> */
    public array $customers = [];

    /** @var array<string, object> */
    public array $subscriptions = [];

    /** @var array<string, object> */
    public array $sessions = [];

    /** @var array<string, object> */
    public array $invoices = [];

    public int $checkoutCreated = 0;

    public int $subscriptionUpdates = 0;

    public int $portalSessions = 0;

    public bool $failNextUpdate = false;

    public string $failNextUpdateMessage = 'Your card was declined.';

    public function createCheckoutSession(array $params): object
    {
        $this->checkoutCreated++;
        $id = 'cs_test_'.(count($this->sessions) + 1);
        $subId = 'sub_test_'.(count($this->subscriptions) + 1);
        $customer = $params['customer'] ?? ('cus_test_'.(count($this->customers) + 1));
        $invoiceId = 'in_test_checkout_'.(count($this->invoices) + 1);

        $periodEnd = time() + 30 * 24 * 3600;
        $subscription = (object) [
            'id' => $subId,
            'status' => 'active',
            'customer' => $customer,
            'current_period_end' => $periodEnd,
            'cancel_at_period_end' => false,
            'items' => (object) [
                'data' => [
                    (object) [
                        'id' => 'si_test_1',
                        'price' => (object) ['id' => $params['line_items'][0]['price'] ?? 'price_test_monthly'],
                    ],
                ],
            ],
            'metadata' => (object) ($params['subscription_data']['metadata'] ?? []),
        ];
        $this->subscriptions[$subId] = $subscription;
        $this->customers[$customer] = (object) ['id' => $customer, 'email' => $params['customer_email'] ?? null];

        $invoice = (object) [
            'id' => $invoiceId,
            'subscription' => $subId,
            'status' => 'paid',
            'number' => 'INV-1',
            'subtotal' => 4900,
            'tax' => 0,
            'amount_paid' => 4900,
            'currency' => 'cad',
            'invoice_pdf' => null,
            'hosted_invoice_url' => null,
            'status_transitions' => (object) ['paid_at' => time()],
            'billing_reason' => 'subscription_create',
        ];
        $this->invoices[$invoiceId] = $invoice;

        $session = (object) [
            'id' => $id,
            'url' => 'https://checkout.stripe.test/'.$id,
            'mode' => 'subscription',
            'status' => 'complete',
            'payment_status' => 'paid',
            'client_reference_id' => $params['client_reference_id'] ?? null,
            'customer' => $customer,
            'subscription' => $subscription,
            'invoice' => $invoice,
            'metadata' => (object) ($params['metadata'] ?? []),
            'amount_subtotal' => 4900,
            'total_details' => (object) ['amount_tax' => 0],
            'amount_total' => 4900,
        ];
        $this->sessions[$id] = $session;

        return $session;
    }

    public function retrieveCheckoutSession(string $id, array $expand = []): object
    {
        if (! isset($this->sessions[$id])) {
            throw new RuntimeException('Checkout session not found');
        }

        return $this->sessions[$id];
    }

    public function retrieveSubscription(string $id, array $params = []): object
    {
        if (! isset($this->subscriptions[$id])) {
            throw new RuntimeException('Subscription not found');
        }

        return $this->subscriptions[$id];
    }

    public function updateSubscription(string $id, array $params): object
    {
        if ($this->failNextUpdate) {
            $this->failNextUpdate = false;
            throw new RuntimeException($this->failNextUpdateMessage);
        }

        $sub = $this->retrieveSubscription($id);
        $this->subscriptionUpdates++;

        if (isset($params['cancel_at_period_end'])) {
            $sub->cancel_at_period_end = (bool) $params['cancel_at_period_end'];
        }
        if (isset($params['items'][0]['price'])) {
            $sub->items->data[0]->price->id = $params['items'][0]['price'];
        }
        if (($params['payment_behavior'] ?? null) === 'error_if_incomplete' && $this->failNextUpdate) {
            throw new RuntimeException($this->failNextUpdateMessage);
        }

        $this->subscriptions[$id] = $sub;

        return $sub;
    }

    public function previewInvoice(array $params): object
    {
        $subId = $params['subscription'] ?? '';
        $sub = $subId ? $this->retrieveSubscription($subId) : null;
        $periodEnd = $sub->current_period_end ?? (time() + 30 * 24 * 3600);

        return (object) [
            'id' => 'in_preview_1',
            'subtotal' => 2000,
            'tax' => 260,
            'amount_due' => 2260,
            'currency' => 'cad',
            'lines' => (object) [
                'data' => [
                    (object) ['amount' => -1500, 'description' => 'Unused time on Starter', 'proration' => true],
                    (object) ['amount' => 3500, 'description' => 'Remaining time on Pro', 'proration' => true],
                ],
            ],
            'period_end' => $periodEnd,
            'next_payment_attempt' => $periodEnd,
        ];
    }

    public function createBillingPortalSession(array $params): object
    {
        $this->portalSessions++;

        return (object) [
            'id' => 'bps_test_1',
            'url' => 'https://billing.stripe.test/session/bps_test_1',
        ];
    }

    public function listCustomerSubscriptions(string $customerId): array
    {
        return array_values(array_filter(
            $this->subscriptions,
            fn ($sub) => ($sub->customer ?? null) === $customerId
        ));
    }

    public function createCustomer(string $email, int $userId): object
    {
        $id = 'cus_test_'.(count($this->customers) + 1);
        $customer = (object) ['id' => $id, 'email' => $email, 'metadata' => (object) ['user_id' => (string) $userId]];
        $this->customers[$id] = $customer;

        return $customer;
    }

    /** @var array<int, object> */
    public array $invoiceItems = [];

    /** @var array<string, string> */
    public array $paymentIntentInvoices = [];

    public function createInvoiceCreditItem(string $customerId, string $invoiceId, float $amountCad, string $description): object
    {
        $item = (object) [
            'id' => 'ii_wallet_'.(count($this->invoiceItems) + 1),
            'customer' => $customerId,
            'invoice' => $invoiceId,
            'amount' => (int) round($amountCad * -100),
            'currency' => 'cad',
            'description' => $description,
        ];
        $this->invoiceItems[] = $item;

        return $item;
    }

    public function invoiceIdForPaymentIntent(string $paymentIntentId): ?string
    {
        return $this->paymentIntentInvoices[$paymentIntentId] ?? null;
    }

    public function seedSubscription(string $id, string $customerId, string $priceId = 'price_test_monthly', string $status = 'active'): object
    {
        $sub = (object) [
            'id' => $id,
            'status' => $status,
            'customer' => $customerId,
            'current_period_end' => time() + 30 * 24 * 3600,
            'cancel_at_period_end' => false,
            'items' => (object) [
                'data' => [
                    (object) ['id' => 'si_'.$id, 'price' => (object) ['id' => $priceId]],
                ],
            ],
            'metadata' => (object) ['type' => 'platform_subscription'],
        ];
        $this->subscriptions[$id] = $sub;
        $this->customers[$customerId] ??= (object) ['id' => $customerId];

        return $sub;
    }
}

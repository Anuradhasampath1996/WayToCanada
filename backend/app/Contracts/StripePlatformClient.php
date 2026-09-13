<?php

namespace App\Contracts;

interface StripePlatformClient
{
    /** @param array<string, mixed> $params @return object{id: string, url: ?string} */
    public function createCheckoutSession(array $params): object;

    /** @param list<string> $expand */
    public function retrieveCheckoutSession(string $id, array $expand = []): object;

    /** @param array<string, mixed> $params */
    public function retrieveSubscription(string $id, array $params = []): object;

    /** @param array<string, mixed> $params */
    public function updateSubscription(string $id, array $params): object;

    /** @param array<string, mixed> $params */
    public function previewInvoice(array $params): object;

    /** @param array<string, mixed> $params @return object{id: string, url: string} */
    public function createBillingPortalSession(array $params): object;

    /** @return list<object> */
    public function listCustomerSubscriptions(string $customerId): array;

    public function createCustomer(string $email, int $userId): object;
}

<?php

namespace App\Services;

use App\Models\ConsultantPaymentAccount;
use App\Models\User;
use Stripe\Account;
use Stripe\AccountLink;

class ConsultantStripeConnectService extends StripeService
{
    public function getOrCreateAccount(User $consultant): ConsultantPaymentAccount
    {
        return ConsultantPaymentAccount::firstOrCreate(
            ['user_id' => $consultant->id],
            ['preferred_provider' => 'stripe']
        );
    }

    public function syncAccountStatus(ConsultantPaymentAccount $account): ConsultantPaymentAccount
    {
        if (! $account->stripe_connect_account_id) {
            return $account;
        }

        $stripeAccount = Account::retrieve($account->stripe_connect_account_id);

        $account->update([
            'stripe_charges_enabled'   => (bool) ($stripeAccount->charges_enabled ?? false),
            'stripe_details_submitted' => (bool) ($stripeAccount->details_submitted ?? false),
        ]);

        return $account->fresh();
    }

    /**
     * @return array{url: string, account_id: string}
     */
    public function createOnboardingLink(User $consultant, string $returnUrl, string $refreshUrl): array
    {
        $record = $this->getOrCreateAccount($consultant);

        if (! $record->stripe_connect_account_id) {
            $stripeAccount = Account::create([
                'type'         => 'express',
                'country'      => 'CA',
                'email'        => $consultant->email,
                'capabilities' => [
                    'card_payments' => ['requested' => true],
                    'transfers'     => ['requested' => true],
                ],
                'business_profile' => [
                    'name' => $consultant->company_name ?: $consultant->name,
                ],
                'metadata' => [
                    'consultant_user_id' => (string) $consultant->id,
                ],
            ]);

            $record->update(['stripe_connect_account_id' => $stripeAccount->id]);
        }

        $link = AccountLink::create([
            'account'     => $record->stripe_connect_account_id,
            'refresh_url' => $refreshUrl,
            'return_url'  => $returnUrl,
            'type'        => 'account_onboarding',
        ]);

        return [
            'url'        => $link->url,
            'account_id' => $record->stripe_connect_account_id,
        ];
    }

    public function createDashboardLink(ConsultantPaymentAccount $account): ?string
    {
        if (! $account->stripe_connect_account_id) {
            return null;
        }

        $login = Account::createLoginLink($account->stripe_connect_account_id);

        return $login->url;
    }
}

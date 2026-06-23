<?php

namespace Database\Seeders;

use App\Models\ConsultantMarketingOrder;
use App\Models\ConsultantSubscription;
use App\Models\MarketingService;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPaymentRecord;
use App\Models\User;
use App\Services\CanadianBillingTaxService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class BillingDemoSeeder extends Seeder
{
    public function run(): void
    {
        $email = 'anuradhasampath666@gmail.com';

        $user = User::where('email', $email)->first();
        if (! $user) {
            $this->command->error("User not found: {$email}");

            return;
        }

        $package = SubscriptionPackage::where('is_active', true)->orderBy('sort_order')->first()
            ?? SubscriptionPackage::query()->first();

        if (! $package) {
            $this->command->error('No subscription package found. Run package seeders first.');

            return;
        }

        $monthlyPrice = (float) ($package->monthly_price ?? 99.0);
        $billingAddressOn = [
            'line1'       => '123 Bay Street',
            'line2'       => 'Suite 400',
            'city'        => 'Toronto',
            'province'    => 'ON',
            'postal_code' => 'M5J 2T3',
            'country'     => 'CA',
        ];

        $billingAddressUs = [
            'line1'       => '500 Fifth Avenue',
            'line2'       => '',
            'city'        => 'New York',
            'province'    => 'NY',
            'postal_code' => '10110',
            'country'     => 'US',
        ];

        $taxService = app(CanadianBillingTaxService::class);
        $onTax      = $taxService->quote($monthlyPrice, $billingAddressOn);
        $usTax      = $taxService->quote($monthlyPrice, $billingAddressUs);

        $subscription = ConsultantSubscription::where('user_id', $user->id)->latest()->first();

        if ($subscription) {
            $subscription->update([
                'subscription_package_id' => $package->id,
                'status'                  => 'active',
                'is_trial'                => false,
                'trial_ends_at'           => null,
                'starts_at'               => now()->subMonths(3),
                'ends_at'                 => now()->addMonth(),
                'billing_cycle'           => 'monthly',
                'last_payment_at'         => now()->subDays(5),
                'cancelled_at'            => null,
                'stripe_customer_id'      => 'cus_demo_' . $user->id,
                'stripe_subscription_id'  => 'sub_demo_' . $user->id,
                'billing_country'         => 'CA',
                'billing_province'        => 'ON',
                'billing_address'         => $billingAddressOn,
            ]);
        } else {
            $subscription = ConsultantSubscription::create([
                'user_id'                 => $user->id,
                'subscription_package_id' => $package->id,
                'status'                  => 'active',
                'is_trial'                => false,
                'starts_at'               => now()->subMonths(3),
                'ends_at'                 => now()->addMonth(),
                'billing_cycle'           => 'monthly',
                'last_payment_at'         => now()->subDays(5),
                'stripe_customer_id'      => 'cus_demo_' . $user->id,
                'stripe_subscription_id'  => 'sub_demo_' . $user->id,
                'billing_country'         => 'CA',
                'billing_province'        => 'ON',
                'billing_address'         => $billingAddressOn,
            ]);
        }

        SubscriptionPaymentRecord::where('user_id', $user->id)->delete();

        $payments = [
            [
                'payment_type'   => SubscriptionPaymentRecord::TYPE_INITIAL,
                'billing_cycle'  => 'monthly',
                'invoice_number' => 'RCM-2026-000101',
                'paid_at'        => now()->subMonths(2),
                'address'        => $billingAddressOn,
                'tax'            => $onTax,
                'stripe_invoice_id' => 'in_demo_initial_' . $user->id,
            ],
            [
                'payment_type'   => SubscriptionPaymentRecord::TYPE_RENEWAL,
                'billing_cycle'  => 'monthly',
                'invoice_number' => 'RCM-2026-000102',
                'paid_at'        => now()->subMonth(),
                'address'        => $billingAddressOn,
                'tax'            => $onTax,
                'stripe_invoice_id' => 'in_demo_renewal1_' . $user->id,
            ],
            [
                'payment_type'   => SubscriptionPaymentRecord::TYPE_RENEWAL,
                'billing_cycle'  => 'monthly',
                'invoice_number' => 'RCM-2026-000103',
                'paid_at'        => now()->subDays(5),
                'address'        => $billingAddressOn,
                'tax'            => $onTax,
                'stripe_invoice_id' => 'in_demo_renewal2_' . $user->id,
            ],
            [
                'payment_type'   => SubscriptionPaymentRecord::TYPE_RENEWAL,
                'billing_cycle'  => 'monthly',
                'invoice_number' => 'RCM-2026-000104',
                'paid_at'        => now()->subDays(45),
                'address'        => $billingAddressUs,
                'tax'            => $usTax,
                'stripe_invoice_id' => 'in_demo_export_' . $user->id,
            ],
        ];

        foreach ($payments as $row) {
            $tax = $row['tax'];
            SubscriptionPaymentRecord::create([
                'user_id'                    => $user->id,
                'consultant_subscription_id' => $subscription->id,
                'subscription_package_id'    => $package->id,
                'payment_type'               => $row['payment_type'],
                'billing_cycle'              => $row['billing_cycle'],
                'stripe_invoice_id'          => $row['stripe_invoice_id'],
                'stripe_subscription_id'     => $subscription->stripe_subscription_id,
                'invoice_number'             => $row['invoice_number'],
                'currency'                   => 'CAD',
                'subtotal'                   => $tax['subtotal'],
                'tax_amount'                 => $tax['total_tax'],
                'total'                      => $tax['total'],
                'tax_label'                  => $tax['tax_label'],
                'tax_type'                   => $tax['tax_type'],
                'province'                   => $tax['province'] ?? ($row['address']['province'] ?? null),
                'country'                    => $row['address']['country'],
                'gst_amount'                 => $tax['gst_amount'] ?? null,
                'provincial_tax'             => $tax['provincial_tax'] ?? null,
                'total_rate_pct'             => $tax['total_rate_pct'] ?? null,
                'tax_applicable'             => (bool) ($tax['tax_applicable'] ?? ($tax['total_tax'] > 0)),
                'billing_address'            => $row['address'],
                'invoice_pdf'                => null,
                'hosted_invoice_url'         => null,
                'paid_at'                    => Carbon::parse($row['paid_at']),
            ]);
        }

        $subscription->update(['last_payment_at' => now()->subDays(5)]);

        $count = SubscriptionPaymentRecord::where('user_id', $user->id)->count();

        ConsultantMarketingOrder::where('user_id', $user->id)->delete();

        $marketingServices = MarketingService::where('is_active', true)->orderBy('sort_order')->limit(2)->get();
        $marketingCount    = 0;

        foreach ($marketingServices as $index => $service) {
            $amount = (float) ($service->price ?? 299);
            $tax    = round($amount * 0.13, 2);

            ConsultantMarketingOrder::create([
                'user_id'              => $user->id,
                'marketing_service_id' => $service->id,
                'status'               => $index === 0
                    ? ConsultantMarketingOrder::STATUS_ACTIVE
                    : ConsultantMarketingOrder::STATUS_PAID,
                'amount'               => $amount,
                'billing_type'         => $service->billing_type ?? MarketingService::BILLING_ONE_TIME,
                'province'             => 'ON',
                'tax_amount'           => $tax,
                'paid_at'              => now()->subDays($index === 0 ? 12 : 30),
                'starts_at'            => now()->subDays($index === 0 ? 12 : 30),
            ]);
            $marketingCount++;
        }

        $this->command->info("Seeded billing demo for {$email}");
        $this->command->info("  Subscription: {$subscription->id} ({$package->name}, active)");
        $this->command->info("  Payment records: {$count}");
        $this->command->info("  Marketing orders: {$marketingCount}");
    }
}

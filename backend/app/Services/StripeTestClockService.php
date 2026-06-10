<?php

namespace App\Services;

use App\Models\PaymentGatewaySetting;
use Carbon\Carbon;
use Stripe\Customer;
use Stripe\TestHelpers\TestClock;

class StripeTestClockService extends StripeService
{
    public function status(): array
    {
        $setting = $this->getStripeSetting();

        if (! $this->isTestMode()) {
            return [
                'available'          => false,
                'message'            => 'Test Clock is only available in Test mode.',
                'use_test_clock'     => false,
                'test_clock_id'      => null,
                'frozen_time'        => null,
                'frozen_time_human'  => null,
            ];
        }

        $clockId = $setting->stripe_test_clock_id;
        if (! $clockId) {
            return [
                'available'         => true,
                'use_test_clock'    => (bool) $setting->use_test_clock,
                'test_clock_id'     => null,
                'frozen_time'       => null,
                'frozen_time_human' => null,
                'message'           => 'Test Clock not created yet. Enable it below.',
            ];
        }

        try {
            $clock = TestClock::retrieve($clockId);

            return [
                'available'         => true,
                'use_test_clock'    => (bool) $setting->use_test_clock,
                'test_clock_id'     => $clock->id,
                'frozen_time'       => $clock->frozen_time,
                'frozen_time_human' => Carbon::createFromTimestamp($clock->frozen_time)->toIso8601String(),
                'status'            => $clock->status,
            ];
        } catch (\Throwable $e) {
            return [
                'available'         => true,
                'use_test_clock'    => (bool) $setting->use_test_clock,
                'test_clock_id'     => $clockId,
                'error'             => $e->getMessage(),
            ];
        }
    }

    public function enable(bool $useForCheckouts = true): array
    {
        if (! $this->isTestMode()) {
            throw new \RuntimeException('Test Clock can only be enabled in Test mode.');
        }

        $setting = $this->getStripeSetting();

        if (! $setting->stripe_test_clock_id) {
            $clock = TestClock::create([
                'frozen_time' => time(),
                'name'        => 'WayToCanada — recurring test',
            ]);
            $setting->stripe_test_clock_id = $clock->id;
        }

        $setting->use_test_clock = $useForCheckouts;
        $setting->save();

        return $this->status();
    }

    public function disable(): array
    {
        $setting = $this->getStripeSetting();
        $setting->use_test_clock = false;
        $setting->save();

        return $this->status();
    }

    public function advance(string $cycle = 'monthly'): array
    {
        if (! $this->isTestMode()) {
            throw new \RuntimeException('Test Clock can only be advanced in Test mode.');
        }

        $setting = $this->getStripeSetting();
        $clockId = $setting->stripe_test_clock_id;

        if (! $clockId) {
            throw new \RuntimeException('Test Clock is not enabled. Enable it first.');
        }

        $clock = TestClock::retrieve($clockId);
        $seconds = $cycle === 'yearly' ? 366 * 86400 : 32 * 86400;
        $newTime = $clock->frozen_time + $seconds;

        $advanced = $clock->advance([
            'frozen_time' => $newTime,
        ]);

        return [
            'message'           => 'Test Clock advanced. Stripe is processing renewals — wait a few seconds then sync.',
            'advanced_by'       => $cycle === 'yearly' ? '1 year' : '1 month',
            'frozen_time'       => $advanced->frozen_time,
            'frozen_time_human' => Carbon::createFromTimestamp($advanced->frozen_time)->toIso8601String(),
            'status'            => $advanced->status,
        ];
    }

    public function getTestClockId(): ?string
    {
        $setting = PaymentGatewaySetting::where('gateway', 'stripe')->first();
        if (! $setting || ! $setting->use_test_clock || ! $this->isTestMode()) {
            return null;
        }

        return $setting->stripe_test_clock_id;
    }

    public function ensureCustomer(string $email, int $userId): string
    {
        $clockId = $this->getTestClockId();
        if (! $clockId) {
            throw new \RuntimeException('Test Clock is not enabled for checkouts.');
        }

        $customers = Customer::all(['email' => $email, 'limit' => 20]);
        foreach ($customers->data as $customer) {
            if (($customer->test_clock ?? null) === $clockId
                && ($customer->metadata['user_id'] ?? '') === (string) $userId) {
                return $customer->id;
            }
        }

        $customer = Customer::create([
            'email'      => $email,
            'test_clock' => $clockId,
            'metadata'   => ['user_id' => (string) $userId],
        ]);

        return $customer->id;
    }

    private function getStripeSetting(): PaymentGatewaySetting
    {
        $setting = PaymentGatewaySetting::where('gateway', 'stripe')->first();
        if (! $setting) {
            throw new \RuntimeException('Stripe gateway settings not found.');
        }

        return $setting;
    }
}

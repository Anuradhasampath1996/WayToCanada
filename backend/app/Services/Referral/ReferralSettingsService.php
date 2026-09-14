<?php

namespace App\Services\Referral;

use App\Models\ReferralRewardRule;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReferralSettingsService
{
    public function current(): ReferralRewardRule
    {
        $rule = ReferralRewardRule::query()
            ->whereNull('effective_to')
            ->orderByDesc('version')
            ->first();

        return $rule ?? $this->ensureDefault();
    }

    public function programEnabled(): bool
    {
        return (bool) $this->current()->program_enabled;
    }

    public function ensureDefault(): ReferralRewardRule
    {
        $existing = ReferralRewardRule::query()->whereNull('effective_to')->orderByDesc('version')->first();
        if ($existing) {
            return $existing;
        }

        $defaults = config('referral.defaults');

        return ReferralRewardRule::query()->create([
            'version' => 1,
            'effective_from' => now(),
            'effective_to' => null,
            'program_enabled' => (bool) $defaults['program_enabled'],
            'reward_type' => 'fixed',
            'reward_value' => $defaults['reward_value'],
            'currency' => config('referral.currency', 'CAD'),
            'eligible_package_ids' => null,
            'applies_to' => $defaults['applies_to'],
            'hold_days' => $defaults['hold_days'],
            'withdrawal_minimum' => $defaults['withdrawal_minimum'],
            'withdrawal_maximum' => null,
            'wallet_credit_enabled' => (bool) $defaults['wallet_credit_enabled'],
            'terms_markdown' => $defaults['terms_markdown'],
            'created_by' => null,
        ]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function publish(array $attributes, ?int $actorId = null): ReferralRewardRule
    {
        return DB::connection('cws')->transaction(function () use ($attributes, $actorId) {
            $current = $this->current();
            $now = Carbon::now();

            $current->update(['effective_to' => $now]);

            $eligible = $attributes['eligible_package_ids'] ?? $current->eligible_package_ids;
            if (is_array($eligible) && $eligible === []) {
                $eligible = null;
            }

            return ReferralRewardRule::query()->create([
                'version' => ((int) $current->version) + 1,
                'effective_from' => $now,
                'effective_to' => null,
                'program_enabled' => (bool) ($attributes['program_enabled'] ?? $current->program_enabled),
                'reward_type' => 'fixed',
                'reward_value' => $attributes['reward_value'] ?? $current->reward_value,
                'currency' => config('referral.currency', 'CAD'),
                'eligible_package_ids' => $eligible,
                'applies_to' => 'first_paid_subscription_only',
                'hold_days' => $attributes['hold_days'] ?? $current->hold_days,
                'withdrawal_minimum' => $attributes['withdrawal_minimum'] ?? $current->withdrawal_minimum,
                'withdrawal_maximum' => array_key_exists('withdrawal_maximum', $attributes)
                    ? $attributes['withdrawal_maximum']
                    : $current->withdrawal_maximum,
                'wallet_credit_enabled' => (bool) ($attributes['wallet_credit_enabled'] ?? $current->wallet_credit_enabled),
                'terms_markdown' => $attributes['terms_markdown'] ?? $current->terms_markdown,
                'created_by' => $actorId,
            ]);
        });
    }
}

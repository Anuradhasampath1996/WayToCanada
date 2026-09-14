<?php

namespace App\Services\Referral;

use App\Models\ConsultantReferral;
use App\Models\ReferralRiskFlag;
use App\Models\User;

class ReferralRiskService
{
    /**
     * @param  array<string, mixed>|null  $details
     */
    public function flag(
        string $code,
        string $severity = 'review',
        ?ConsultantReferral $referral = null,
        ?User $user = null,
        ?array $details = null,
    ): ReferralRiskFlag {
        $existing = ReferralRiskFlag::query()
            ->where('code', $code)
            ->where('status', 'open')
            ->when($referral, fn ($q) => $q->where('referral_id', $referral->id))
            ->when(! $referral && $user, fn ($q) => $q->where('user_id', $user->id))
            ->first();

        if ($existing) {
            return $existing;
        }

        return ReferralRiskFlag::query()->create([
            'referral_id' => $referral?->id,
            'user_id' => $user?->id ?? $referral?->referred_user_id,
            'code' => $code,
            'severity' => $severity,
            'status' => 'open',
            'details' => $details,
        ]);
    }

    public function flagSharedOfficeIp(ConsultantReferral $referral, ?string $ipHash): void
    {
        if (! $ipHash) {
            return;
        }

        $this->flag('shared_office_ip', 'review', $referral, $referral->referred, [
            'ip_hash' => $ipHash,
            'note' => 'Shared IP is a review signal only and is never an automatic rejection.',
        ]);
    }

    public function flagSameRcic(ConsultantReferral $referral, string $rcicNumber): ReferralRiskFlag
    {
        return $this->flag('same_rcic_number', 'high', $referral, $referral->referred, [
            'rcic_number' => $rcicNumber,
        ]);
    }
}

<?php

namespace App\Services\Referral;

use App\Models\ConsultantReferral;
use App\Models\ConsultantReferralClick;
use App\Models\ConsultantReferralCode;
use App\Models\User;
use Illuminate\Http\Request;

class ReferralAttributionService
{
    public function __construct(
        private ReferralSettingsService $settings,
        private ReferralCodeService $codes,
        private ReferralCookie $cookie,
        private ReferralAuditService $audit,
        private ReferralRiskService $risk,
        private ReferralNotificationService $notifications,
    ) {}

    /**
     * @return array{code: ConsultantReferralCode, cookie: string, click_id: int, program_enabled: bool}|null
     */
    public function attributeClick(string $code, Request $request): ?array
    {
        $row = $this->codes->findByCode($code);
        if (! $row) {
            return null;
        }

        $ipHash = $this->codes->hashIp($request->ip());
        $click = ConsultantReferralClick::query()->create([
            'code' => $row->code,
            'referrer_user_id' => $row->user_id,
            'ip_hash' => $ipHash,
            'user_agent_hash' => $this->codes->hashUserAgent($request->userAgent()),
        ]);

        $payload = $this->cookie->payload($row->code, $ipHash);

        return [
            'code' => $row,
            'cookie' => $this->cookie->encode($payload),
            'click_id' => $click->id,
            'program_enabled' => $this->settings->programEnabled(),
        ];
    }

    public function resolveCode(?string $code, Request $request): ?string
    {
        $fromBody = is_string($code) ? strtoupper(trim($code)) : '';
        if ($fromBody !== '') {
            return $fromBody;
        }

        $cookieName = (string) config('referral.cookie_name', 'wtc_ref');
        $decoded = $this->cookie->decode($request->cookie($cookieName));

        return $decoded['code'] ?? null;
    }

    public function attachOnRegistration(User $referred, Request $request, ?string $explicitCode = null): ?ConsultantReferral
    {
        if (ConsultantReferral::query()->where('referred_user_id', $referred->id)->exists()) {
            return ConsultantReferral::query()->where('referred_user_id', $referred->id)->first();
        }

        if (! $this->settings->programEnabled()) {
            return null;
        }

        $codeValue = $this->resolveCode($explicitCode, $request);
        if (! $codeValue) {
            return null;
        }

        $code = $this->codes->findByCode($codeValue);
        if (! $code) {
            return null;
        }

        if ((int) $code->user_id === (int) $referred->id) {
            $this->audit->recordFromRequest($request, 'self_referral_blocked', 'user', $referred->id, null, [
                'code' => $code->code,
            ]);

            return null;
        }

        if (strcasecmp((string) $code->user?->email, (string) $referred->email) === 0) {
            $this->audit->recordFromRequest($request, 'self_referral_blocked', 'user', $referred->id, null, [
                'code' => $code->code,
                'reason' => 'same_email',
            ]);

            return null;
        }

        $code->loadMissing('user');
        if ($referred->rcic_number && $code->user?->rcic_number
            && strcasecmp((string) $referred->rcic_number, (string) $code->user->rcic_number) === 0) {
            $this->risk->flag('same_rcic_number', 'high', null, $referred, [
                'rcic_number' => $referred->rcic_number,
                'referrer_user_id' => $code->user_id,
            ]);

            return null;
        }

        $referral = ConsultantReferral::query()->create([
            'referrer_user_id' => $code->user_id,
            'referred_user_id' => $referred->id,
            'referral_code_id' => $code->id,
            'status' => ConsultantReferral::STATUS_REGISTERED,
            'attribution_locked_at' => now(),
        ]);

        $cookieName = (string) config('referral.cookie_name', 'wtc_ref');
        $decoded = $this->cookie->decode($request->cookie($cookieName));
        if (! empty($decoded['ip_hash'])) {
            $this->risk->flagSharedOfficeIp($referral, $decoded['ip_hash']);
        }

        $this->audit->recordFromRequest($request, 'referral_attached', 'consultant_referral', $referral->id, null, [
            'referrer_user_id' => $referral->referrer_user_id,
            'referred_user_id' => $referral->referred_user_id,
            'code' => $code->code,
        ]);

        $referral->load(['referrer', 'referred']);
        $this->notifications->referralRegistered($referral);

        return $referral;
    }

    public function attachFromCode(User $referred, string $codeValue, ?Request $request = null): ?ConsultantReferral
    {
        $request ??= request();

        return $this->attachOnRegistration($referred, $request, $codeValue);
    }
}

<?php

namespace App\Http\Controllers;

use App\Services\Referral\ReferralAttributionService;
use App\Services\Referral\ReferralCodeService;
use App\Services\Referral\ReferralSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicReferralController extends Controller
{
    public function __construct(
        private ReferralAttributionService $attribution,
        private ReferralCodeService $codes,
        private ReferralSettingsService $settings,
    ) {}

    public function resolve(string $code): JsonResponse
    {
        $row = $this->codes->findByCode($code);
        if (! $row) {
            return response()->json(['valid' => false, 'message' => 'Referral link not found.'], 404);
        }

        return response()->json([
            'valid' => true,
            'code' => $row->code,
            'program_enabled' => $this->settings->programEnabled(),
            'referrer_first_name' => $this->codes->firstName($row->user),
        ]);
    }

    public function attribute(Request $request, string $code): JsonResponse
    {
        $result = $this->attribution->attributeClick($code, $request);
        if (! $result) {
            return response()->json(['valid' => false, 'message' => 'Referral link not found.'], 404);
        }

        $days = (int) config('referral.cookie_days', 90);
        $cookieName = (string) config('referral.cookie_name', 'wtc_ref');

        return response()->json([
            'valid' => true,
            'code' => $result['code']->code,
            'program_enabled' => $result['program_enabled'],
            'referrer_first_name' => $this->codes->firstName($result['code']->user),
            'redirect' => '/register?ref='.$result['code']->code,
            'cookie' => [
                'name' => $cookieName,
                'value' => $result['cookie'],
                'days' => $days,
            ],
        ])->cookie($cookieName, $result['cookie'], $days * 1440, '/', null, $request->secure(), true, false, 'lax');
    }
}

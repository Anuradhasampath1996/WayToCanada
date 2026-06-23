<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\PlatformCompanySettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPlatformCompanyController extends Controller
{
    public function __construct(
        private PlatformCompanySettingsService $settings,
    ) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->settings->toArray()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'legal_name'      => 'nullable|string|max:255',
            'trade_name'      => 'nullable|string|max:255',
            'business_number' => 'nullable|string|max:32',
            'gst_hst_number'  => 'nullable|string|max:32',
            'qst_number'      => 'nullable|string|max:32',
            'pst_number'      => 'nullable|string|max:32',
            'address_line1'   => 'nullable|string|max:255',
            'address_line2'   => 'nullable|string|max:255',
            'city'            => 'nullable|string|max:120',
            'province'        => 'nullable|string|max:8',
            'postal_code'     => 'nullable|string|max:16',
            'country'         => 'nullable|string|max:8',
            'phone'           => 'nullable|string|max:32',
            'billing_email'   => 'nullable|email|max:255',
            'support_email'   => 'nullable|email|max:255',
            'website'         => 'nullable|string|max:255',
            'invoice_footer'  => 'nullable|string|max:2000',
            'invoice_prefix'  => 'nullable|string|max:16',
        ]);

        $setting = $this->settings->update($data, $request->user()->id);

        return response()->json([
            'message' => 'Company invoice settings saved. New invoices will use these details.',
            'data'    => $this->settings->toArray($setting),
        ]);
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate([
            'logo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $setting = $this->settings->uploadLogo($request->file('logo'), $request->user()->id);

        return response()->json([
            'message'  => 'Company logo uploaded.',
            'data'     => $this->settings->toArray($setting),
        ]);
    }

    public function removeLogo(Request $request): JsonResponse
    {
        $setting = $this->settings->removeLogo($request->user()->id);

        return response()->json([
            'message' => 'Company logo removed.',
            'data'    => $this->settings->toArray($setting),
        ]);
    }
}

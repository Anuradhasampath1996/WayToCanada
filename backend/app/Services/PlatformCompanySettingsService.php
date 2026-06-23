<?php

namespace App\Services;

use App\Models\PlatformCompanySetting;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class PlatformCompanySettingsService
{
    public function get(): PlatformCompanySetting
    {
        return PlatformCompanySetting::firstOrCreate([], $this->defaults());
    }

    /** @return array<string, mixed> */
    public function toArray(?PlatformCompanySetting $setting = null): array
    {
        $s = $setting ?? $this->get();

        return [
            'legal_name'        => $s->legal_name,
            'trade_name'        => $s->trade_name,
            'business_number'   => $s->business_number,
            'gst_hst_number'    => $s->gst_hst_number,
            'qst_number'        => $s->qst_number,
            'pst_number'        => $s->pst_number,
            'address_line1'     => $s->address_line1,
            'address_line2'     => $s->address_line2,
            'city'              => $s->city,
            'province'          => $s->province,
            'postal_code'       => $s->postal_code,
            'country'           => $s->country ?? 'CA',
            'phone'             => $s->phone,
            'billing_email'     => $s->billing_email,
            'support_email'     => $s->support_email,
            'website'           => $s->website,
            'invoice_footer'    => $s->invoice_footer,
            'invoice_prefix'    => $s->invoice_prefix ?? 'RCM',
            'logo_url'          => $s->logo_url,
            'updated_at'        => $s->updated_at?->toIso8601String(),
        ];
    }

    /** @return list<string> */
    public function formattedAddressLines(?PlatformCompanySetting $setting = null): array
    {
        $s = $setting ?? $this->get();

        return array_values(array_filter([
            $s->legal_name ?: $s->trade_name,
            $s->address_line1,
            $s->address_line2,
            trim(implode(', ', array_filter([$s->city, $s->province, $s->postal_code]))),
            $s->country === 'CA' ? 'Canada' : $s->country,
        ]));
    }

    /** @param array<string, mixed> $data */
    public function update(array $data, ?int $adminUserId = null): PlatformCompanySetting
    {
        $setting = $this->get();

        $fields = [
            'legal_name', 'trade_name', 'business_number', 'gst_hst_number', 'qst_number', 'pst_number',
            'address_line1', 'address_line2', 'city', 'province', 'postal_code', 'country',
            'phone', 'billing_email', 'support_email', 'website', 'invoice_footer', 'invoice_prefix',
        ];

        $payload = [];
        foreach ($fields as $field) {
            if (array_key_exists($field, $data)) {
                $value = is_string($data[$field]) ? trim($data[$field]) : $data[$field];
                $payload[$field] = $value === '' ? null : $value;
            }
        }

        if (isset($payload['country'])) {
            $payload['country'] = strtoupper((string) $payload['country']) ?: 'CA';
        }

        $payload['updated_by'] = $adminUserId;

        $setting->update($payload);

        return $setting->fresh();
    }

    public function uploadLogo(UploadedFile $file, ?int $adminUserId = null): PlatformCompanySetting
    {
        $setting = $this->get();

        if ($setting->logo_url) {
            $this->deleteStoredLogo($setting->logo_url);
        }

        $filename = 'platform/invoice-logo_' . time() . '.' . $file->getClientOriginalExtension();
        $file->storeAs('', $filename, 'public');
        $url = rtrim(config('app.url'), '/') . '/storage/' . $filename;

        $setting->update([
            'logo_url'   => $url,
            'updated_by' => $adminUserId,
        ]);

        return $setting->fresh();
    }

    public function removeLogo(?int $adminUserId = null): PlatformCompanySetting
    {
        $setting = $this->get();

        if ($setting->logo_url) {
            $this->deleteStoredLogo($setting->logo_url);
        }

        $setting->update([
            'logo_url'   => null,
            'updated_by' => $adminUserId,
        ]);

        return $setting->fresh();
    }

    /** @return array<string, mixed> */
    private function defaults(): array
    {
        return [
            'legal_name'     => 'RCICMASTER Inc.',
            'trade_name'     => 'RCICMASTER',
            'address_line1'  => '100 King Street West',
            'city'           => 'Toronto',
            'province'       => 'ON',
            'postal_code'    => 'M5X 1A9',
            'country'        => 'CA',
            'billing_email'  => 'billing@rcicmaster.com',
            'support_email'  => 'support@rcicmaster.com',
            'website'        => 'https://www.rcicmaster.com',
            'invoice_prefix' => 'RCM',
            'invoice_footer' => 'Thank you for your business. This tax invoice is issued in accordance with CRA requirements for Canadian sales tax.',
        ];
    }

    private function deleteStoredLogo(string $logoUrl): void
    {
        $path = str_replace(rtrim(config('app.url'), '/') . '/storage/', '', $logoUrl);
        Storage::disk('public')->delete($path);
    }
}

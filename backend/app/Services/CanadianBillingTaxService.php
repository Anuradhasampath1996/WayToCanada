<?php

namespace App\Services;

class CanadianBillingTaxService
{
    public function __construct(
        private GstHstCalculatorService $calculator,
        private GstHstRatesService $rates,
    ) {}

    /** @return array<string, mixed> */
    public function validateBillingAddress(array $data): array
    {
        $country = $this->normalizeCountry((string) ($data['billing_country'] ?? ''));
        if ($country === '') {
            throw new \InvalidArgumentException('Billing country is required.');
        }

        $address = [
            'line1'       => trim((string) ($data['billing_address_line1'] ?? '')),
            'line2'       => trim((string) ($data['billing_address_line2'] ?? '')),
            'city'        => trim((string) ($data['billing_city'] ?? '')),
            'province'    => trim((string) ($data['billing_province'] ?? $data['province'] ?? '')),
            'postal_code' => trim((string) ($data['billing_postal_code'] ?? '')),
            'country'     => $country,
        ];

        if ($address['line1'] === '' || $address['city'] === '') {
            throw new \InvalidArgumentException('Billing street address and city are required.');
        }

        if ($this->isCanada($country)) {
            $provinceCode = $this->rates->normalizeProvinceCode($address['province']);
            if (! $provinceCode) {
                throw new \InvalidArgumentException('A valid Canadian province is required for tax calculation.');
            }
            $address['province'] = $provinceCode;
        }

        return $address;
    }

    /** @return array<string, mixed> */
    public function quote(float $subtotal, array $billingAddress): array
    {
        $country  = $billingAddress['country'];
        $province = $billingAddress['province'] ?? null;

        if (! $this->isCanada($country)) {
            $subtotal = round($subtotal, 2);

            return [
                'country'         => $country,
                'is_canada'       => false,
                'tax_applicable'  => false,
                'province'        => null,
                'province_name'   => null,
                'tax_type'        => 'export',
                'tax_label'       => 'No Canadian sales tax',
                'subtotal'        => $subtotal,
                'gst_amount'      => 0.0,
                'provincial_tax'  => 0.0,
                'total_tax'       => 0.0,
                'total'           => $subtotal,
                'total_rate_pct'  => 0.0,
                'disclaimer'      => 'Zero-rated under CRA place-of-supply rules — recipient is located outside Canada.',
            ];
        }

        $tax = $this->calculator->calculate($subtotal, (string) $province);
        $tax['country']        = 'CA';
        $tax['is_canada']      = true;
        $tax['tax_applicable'] = true;

        return $tax;
    }

    public function normalizeCountry(string $country): string
    {
        $c = strtoupper(trim($country));
        if ($c === 'CANADA' || $c === 'CAN') {
            return 'CA';
        }

        return strlen($c) === 2 ? $c : strtoupper($country);
    }

    public function isCanada(string $country): bool
    {
        $c = $this->normalizeCountry($country);

        return in_array($c, ['CA', 'CANADA'], true);
    }
}

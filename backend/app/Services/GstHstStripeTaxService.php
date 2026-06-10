<?php

namespace App\Services;

use Stripe\TaxRate;

class GstHstStripeTaxService extends StripeService
{
    public function __construct(
        private GstHstRatesService $ratesService,
    ) {
        parent::__construct();
    }

    /**
     * Return Stripe TaxRate IDs for a province (creates or reuses existing).
     *
     * @return array<int, string>
     */
    public function ensureTaxRates(string $provinceCode): array
    {
        $prov = $this->ratesService->getProvinceRate($provinceCode);
        if (! $prov) {
            throw new \InvalidArgumentException("Unknown province code: {$provinceCode}");
        }

        $version = $this->ratesService->meta()['version'] ?? 'default';
        $type    = $prov['tax_type'];

        if ($type === 'hst' || $type === 'gst_only') {
            return [$this->ensureSingleRate($provinceCode, $version, $prov['label'], (float) $prov['total_rate'], 'combined')];
        }

        $ids = [];
        if ((float) $prov['gst_rate'] > 0) {
            $ids[] = $this->ensureSingleRate($provinceCode, $version, 'GST', (float) $prov['gst_rate'], 'gst');
        }
        if ((float) $prov['prov_rate'] > 0) {
            $label = $type === 'gst_qst' ? 'QST' : 'PST';
            $ids[] = $this->ensureSingleRate($provinceCode, $version, $label, (float) $prov['prov_rate'], $type === 'gst_qst' ? 'qst' : 'pst');
        }

        return $ids;
    }

    private function ensureSingleRate(
        string $provinceCode,
        string $version,
        string $displayName,
        float $rate,
        string $component,
    ): string {
        $pct = round($rate * 100, 4);
        $key = "wtc_{$provinceCode}_{$version}_{$component}_{$pct}";

        $existing = $this->findExistingRate($key);
        if ($existing) {
            return $existing;
        }

        $prov = $this->ratesService->getProvinceRate($provinceCode);
        $taxRate = TaxRate::create([
            'display_name' => $displayName,
            'description'  => ($prov['name'] ?? $provinceCode) . ' — ' . ($prov['label'] ?? $displayName),
            'percentage'   => $pct,
            'inclusive'    => false,
            'country'      => 'CA',
            'state'        => $provinceCode,
            'jurisdiction' => $provinceCode,
            'metadata'     => [
                'wtc_key'      => $key,
                'wtc_province' => $provinceCode,
                'wtc_version'  => $version,
                'wtc_component'=> $component,
            ],
        ]);

        return $taxRate->id;
    }

    private function findExistingRate(string $key): ?string
    {
        $rates = TaxRate::all(['limit' => 100, 'active' => true]);

        foreach ($rates->data as $rate) {
            if (($rate->metadata['wtc_key'] ?? '') === $key) {
                return $rate->id;
            }
        }

        return null;
    }
}

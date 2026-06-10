<?php

namespace App\Services;

use App\Models\GstHstRateVersion;

class GstHstRatesService
{
    public function activeRates(): array
    {
        $active = GstHstRateVersion::active();

        return $active?->rates ?? $this->configPayload();
    }

    public function meta(): array
    {
        $active = GstHstRateVersion::active();
        $config = config('canada_gst_hst_rates');

        return [
            'version'                  => $active?->version ?? $config['version'],
            'effective_date'           => $active?->effective_date?->format('Y-m-d') ?? $config['effective_date'],
            'last_synced_at'           => $active?->last_synced_at?->toIso8601String(),
            'government_pages_changed' => (bool) ($active?->government_pages_changed ?? false),
            'changelog'                => $active?->changelog ?? $config['changelog'] ?? null,
            'source_urls'              => $config['source_urls'] ?? [],
        ];
    }

    public function configPayload(): array
    {
        $config = config('canada_gst_hst_rates');

        return [
            'federal_gst_rate' => $config['federal_gst_rate'],
            'provinces'        => $config['provinces'],
        ];
    }

    public function getProvinceRate(string $province): ?array
    {
        $code = $this->normalizeProvinceCode($province);

        return $code ? ($this->activeRates()['provinces'][$code] ?? null) : null;
    }

    /** Map "Ontario", "on", "ON" → "ON". Returns null if unknown. */
    public function normalizeProvinceCode(string $input): ?string
    {
        $input = trim($input);
        if ($input === '') {
            return null;
        }

        $upper = strtoupper($input);
        $rates = $this->activeRates();

        if (isset($rates['provinces'][$upper])) {
            return $upper;
        }

        $lower = strtolower($input);
        foreach ($rates['provinces'] as $code => $prov) {
            if (strtolower($prov['name']) === $lower) {
                return $code;
            }
        }

        return null;
    }

    /** @return array<int, array{code: string, name: string, label: string}> */
    public function provinceOptions(): array
    {
        $options = [];
        foreach ($this->activeRates()['provinces'] ?? [] as $code => $prov) {
            $options[] = [
                'code'  => $code,
                'name'  => $prov['name'],
                'label' => $prov['label'],
            ];
        }

        usort($options, fn ($a, $b) => strcmp($a['name'], $b['name']));

        return $options;
    }

    /** @return array<int, array<string, mixed>> */
    public function formattedTable(): array
    {
        $rates = $this->activeRates();
        $rows  = [];

        foreach ($rates['provinces'] ?? [] as $code => $prov) {
            $rows[] = [
                'code'       => $code,
                'name'       => $prov['name'],
                'tax_type'   => $prov['tax_type'],
                'gst_rate'   => (float) $prov['gst_rate'],
                'prov_rate'  => (float) $prov['prov_rate'],
                'total_rate' => (float) $prov['total_rate'],
                'gst_pct'    => round((float) $prov['gst_rate'] * 100, 3),
                'prov_pct'   => round((float) $prov['prov_rate'] * 100, 3),
                'total_pct'  => round((float) $prov['total_rate'] * 100, 3),
                'label'      => $prov['label'],
                'notes'      => $prov['notes'] ?? null,
            ];
        }

        usort($rows, fn ($a, $b) => strcmp($a['name'], $b['name']));

        return $rows;
    }
}

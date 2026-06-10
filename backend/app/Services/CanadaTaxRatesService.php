<?php

namespace App\Services;

use App\Models\TaxRateVersion;

class CanadaTaxRatesService
{
    public function activeRates(): array
    {
        $active = TaxRateVersion::active();
        if ($active) {
            return $active->rates;
        }

        return $this->configPayload();
    }

    public function meta(): array
    {
        $active = TaxRateVersion::active();
        $config = config('canada_tax_rates');

        return [
            'version'                    => $active?->version ?? $config['version'],
            'tax_year'                   => $active?->tax_year ?? $config['tax_year'],
            'effective_date'             => $active?->effective_date?->format('Y-m-d')
                ?? $config['effective_date'],
            'last_synced_at'             => $active?->last_synced_at?->toIso8601String(),
            'government_pages_changed'   => (bool) ($active?->government_pages_changed ?? false),
            'changelog'                  => $active?->changelog ?? $config['changelog'] ?? null,
            'source_urls'                => $config['source_urls'] ?? [],
        ];
    }

    public function configPayload(): array
    {
        $config = config('canada_tax_rates');
        $keys   = array_diff(array_keys($config), [
            'version', 'tax_year', 'effective_date', 'changelog', 'source_urls',
        ]);

        return array_intersect_key($config, array_flip($keys));
    }

    /** @return array{federal: array, provinces: array<int, array>, cpp: array, ei: array} */
    public function formattedTables(): array
    {
        $rates = $this->activeRates();

        $formatBrackets = function (array $brackets): array {
            return array_map(
                fn (array $b, int $i) => [
                    'bracket' => $i + 1,
                    'from'    => (float) $b['min'],
                    'to'      => $b['max'] !== null ? (float) $b['max'] : null,
                    'rate'    => (float) $b['rate'],
                    'rate_pct'=> round((float) $b['rate'] * 100, 4),
                ],
                $brackets,
                array_keys($brackets),
            );
        };

        $provinces = [];
        foreach ($rates['provinces'] ?? [] as $code => $prov) {
            $provinces[] = [
                'code'                  => $code,
                'name'                  => $prov['name'],
                'basic_personal_amount' => (float) ($prov['basic_personal_amount'] ?? 0),
                'brackets'              => $formatBrackets($prov['brackets'] ?? []),
            ];
        }

        usort($provinces, fn ($a, $b) => strcmp($a['name'], $b['name']));

        return [
            'federal' => [
                'basic_personal_amount' => (float) ($rates['federal']['basic_personal_amount'] ?? 0),
                'brackets'              => $formatBrackets($rates['federal']['brackets'] ?? []),
            ],
            'provinces' => $provinces,
            'cpp'       => $rates['cpp'] ?? [],
            'ei'        => $rates['ei'] ?? [],
        ];
    }
}

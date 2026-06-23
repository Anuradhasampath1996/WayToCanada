<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GstHstCraFetchService
{
    public const CHARGE_COLLECT_URL = 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html';

    /** @return array{fetched: bool, error: string|null, page_fingerprint: string|null, provinces: array<string, float>, fetched_at: string|null} */
    public function fetchRatesFromCra(): array
    {
        try {
            $response = Http::timeout(45)
                ->withHeaders(['User-Agent' => 'RCICMASTER/1.0 (+https://www.rcicmaster.com)'])
                ->get(self::CHARGE_COLLECT_URL);

            if ($response->failed()) {
                return $this->emptyResult('CRA page returned HTTP ' . $response->status());
            }

            $html = $response->body();
            $parsed = $this->parseProvinceRates($html);

            if ($parsed === []) {
                return $this->emptyResult('Could not parse province rates from CRA page.');
            }

            return [
                'fetched'           => true,
                'error'             => null,
                'page_fingerprint'  => md5($html),
                'provinces'         => $parsed,
                'fetched_at'        => now()->toIso8601String(),
            ];
        } catch (\Throwable $e) {
            Log::warning('[GstHst] CRA fetch failed', ['error' => $e->getMessage()]);

            return $this->emptyResult($e->getMessage());
        }
    }

    /** @return array<string, mixed> */
    public function compareWithActive(GstHstRatesService $ratesService): array
    {
        $fetch   = $this->fetchRatesFromCra();
        $active  = $ratesService->activeRates()['provinces'] ?? [];
        $diffs   = [];
        $matched = 0;

        if ($fetch['fetched']) {
            foreach ($active as $code => $prov) {
                $craTotal = $fetch['provinces'][$code] ?? null;
                if ($craTotal === null) {
                    continue;
                }

                $configTotal = round((float) $prov['total_rate'] * 100, 3);
                if (abs($configTotal - $craTotal) >= 0.05) {
                    $diffs[] = [
                        'code'         => $code,
                        'name'         => $prov['name'],
                        'config_pct'   => $configTotal,
                        'cra_pct'      => $craTotal,
                    ];
                } else {
                    $matched++;
                }
            }
        }

        return [
            'fetch'                 => $fetch,
            'differences'           => $diffs,
            'matched_provinces'     => $matched,
            'has_differences'       => count($diffs) > 0,
            'source_url'            => self::CHARGE_COLLECT_URL,
        ];
    }

    /**
     * Merge CRA total rates into config province structure.
     *
     * @param  array<string, float>  $craTotals  Percentages e.g. ON => 13.0
     * @return array{federal_gst_rate: float, provinces: array<string, array<string, mixed>>}
     */
    public function mergeCraIntoConfig(array $craTotals): array
    {
        $config  = config('canada_gst_hst_rates');
        $merged  = [
            'federal_gst_rate' => (float) $config['federal_gst_rate'],
            'provinces'        => $config['provinces'],
        ];

        foreach ($merged['provinces'] as $code => &$prov) {
            if (! isset($craTotals[$code])) {
                continue;
            }

            $totalRate = round($craTotals[$code] / 100, 4);
            $prov['total_rate'] = $totalRate;

            if ($prov['tax_type'] === 'hst') {
                $prov['gst_rate']  = 0;
                $prov['prov_rate'] = 0;
                $prov['label']     = 'HST ' . rtrim(rtrim(number_format($craTotals[$code], 2, '.', ''), '0'), '.') . '%';
            } elseif ($prov['tax_type'] === 'gst_only') {
                $prov['gst_rate']  = 0.05;
                $prov['prov_rate'] = 0;
                $prov['label']     = 'GST 5%';
            } else {
                $prov['gst_rate']  = 0.05;
                $prov['prov_rate'] = max(0, round($totalRate - 0.05, 4));
                $suffix            = $prov['tax_type'] === 'gst_qst' ? 'QST' : 'PST';
                $prov['label']     = sprintf(
                    'GST 5%% + %s %s%%',
                    $suffix,
                    rtrim(rtrim(number_format($prov['prov_rate'] * 100, 2, '.', ''), '0'), '.')
                );
            }
        }
        unset($prov);

        return $merged;
    }

    /** @return array<string, float> code => total percentage */
    private function parseProvinceRates(string $html): array
    {
        $nameToCode = [];
        foreach (config('canada_gst_hst_rates.provinces', []) as $code => $prov) {
            $nameToCode[strtolower($prov['name'])] = $code;
        }

        libxml_use_internal_errors(true);
        $dom = new \DOMDocument();
        @$dom->loadHTML($html);
        $xpath = new \DOMXPath($dom);

        $rates = [];

        foreach ($xpath->query('//table//tr') as $row) {
            $cells = $row->getElementsByTagName('td');
            if ($cells->length < 2) {
                continue;
            }

            $nameRaw = trim(preg_replace('/\s+/', ' ', $cells->item(0)?->textContent ?? ''));
            $rateRaw = trim($cells->item(1)?->textContent ?? '');

            if ($nameRaw === '' || $rateRaw === '') {
                continue;
            }

            $code = $this->resolveProvinceCode($nameRaw, $nameToCode);
            if (! $code) {
                continue;
            }

            if (preg_match_all('/(\d+(?:\.\d+)?)\s*%/', $rateRaw, $matches)) {
                $total = array_sum(array_map('floatval', $matches[1]));
                if ($total > 0 && $total <= 30) {
                    $rates[$code] = round($total, 3);
                }
            }
        }

        libxml_clear_errors();

        return $rates;
    }

    /** @param  array<string, string>  $nameToCode */
    private function resolveProvinceCode(string $nameRaw, array $nameToCode): ?string
    {
        $lower = strtolower(preg_replace('/\([^)]*\)/', '', $nameRaw));
        $lower = trim($lower);

        if (isset($nameToCode[$lower])) {
            return $nameToCode[$lower];
        }

        foreach ($nameToCode as $name => $code) {
            if (str_contains($lower, $name) || str_contains($name, $lower)) {
                return $code;
            }
        }

        return null;
    }

    /** @return array{fetched: bool, error: string|null, page_fingerprint: string|null, provinces: array<string, float>, fetched_at: string|null} */
    private function emptyResult(?string $error): array
    {
        return [
            'fetched'          => false,
            'error'            => $error,
            'page_fingerprint' => null,
            'provinces'        => [],
            'fetched_at'       => null,
        ];
    }
}

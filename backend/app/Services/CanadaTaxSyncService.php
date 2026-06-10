<?php

namespace App\Services;

use App\Models\TaxRateVersion;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CanadaTaxSyncService
{
    public function __construct(
        private CanadaTaxRatesService $ratesService,
        private CraTaxPageParser $parser,
    ) {}

    public function sync(): array
    {
        $config   = config('canada_tax_rates');
        $checksum = md5(json_encode($config));
        $active   = TaxRateVersion::active();
        $probes   = $this->probeGovernmentSources($config['source_urls'] ?? []);
        $pagesChanged = $this->detectPageChanges($active, $probes);

        $result = [
            'rates_updated'              => false,
            'version'                    => $config['version'],
            'tax_year'                   => $config['tax_year'],
            'government_pages_changed'   => $pagesChanged,
            'source_probes'              => $probes,
        ];

        if (! $active
            || $active->version !== $config['version']
            || $active->source_checksum !== $checksum) {
            if ($active) {
                $active->update(['is_active' => false]);
            }

            TaxRateVersion::create([
                'version'                    => $config['version'],
                'tax_year'                   => $config['tax_year'],
                'effective_date'             => $config['effective_date'],
                'rates'                      => $this->ratesService->configPayload(),
                'source_probes'              => $probes,
                'source_checksum'            => $checksum,
                'is_active'                  => true,
                'government_pages_changed'   => $pagesChanged,
                'changelog'                  => $config['changelog'] ?? null,
                'last_synced_at'             => now(),
            ]);

            $result['rates_updated'] = true;
        } else {
            $active->update([
                'source_probes'              => $probes,
                'government_pages_changed'   => $pagesChanged,
                'last_synced_at'             => now(),
            ]);
        }

        return $result;
    }

    /** @param array<string, string> $urls */
    private function probeGovernmentSources(array $urls): array
    {
        $results = [];

        foreach ($urls as $key => $url) {
            if ($url === '') {
                continue;
            }

            try {
                $response = Http::timeout(30)
                    ->retry(3, 1500, throw: false)
                    ->withHeaders([
                        'User-Agent'      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept'          => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language' => 'en-CA,en;q=0.9',
                    ])
                    ->get($url);

                if (! $response->successful()) {
                    $results[$key] = [
                        'url'    => $url,
                        'status' => 'unreachable',
                        'http'   => $response->status(),
                    ];
                    continue;
                }

                $body = $response->body();
                $results[$key] = array_merge(
                    [
                        'url'          => $url,
                        'status'       => 'ok',
                        'content_hash' => md5($body),
                        'size_bytes'   => strlen($body),
                    ],
                    $this->parser->parse($body, $key),
                );
            } catch (\Throwable $e) {
                Log::warning('[TaxSync] CRA probe failed', ['key' => $key, 'error' => $e->getMessage()]);
                $results[$key] = [
                    'url'     => $url,
                    'status'  => 'error',
                    'message' => $e->getMessage(),
                ];
            }
        }

        return $results;
    }

    private function detectPageChanges(?TaxRateVersion $active, array $probes): bool
    {
        if (! $active || ! is_array($active->source_probes)) {
            return false;
        }

        foreach ($probes as $key => $probe) {
            if (($probe['status'] ?? '') !== 'ok') {
                continue;
            }

            $prev = $active->source_probes[$key] ?? null;
            if ($prev && ($prev['content_hash'] ?? null) !== ($probe['content_hash'] ?? null)) {
                return true;
            }
        }

        return false;
    }
}

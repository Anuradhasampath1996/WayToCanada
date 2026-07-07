<?php

namespace App\Services;

use App\Models\GstHstRateVersion;

class GstHstSyncService
{
    public function __construct(
        private GstHstRatesService $ratesService,
        private GstHstCraFetchService $craFetch,
    ) {}

    /** @return array<string, mixed> */
    public function sync(bool $applyCraRates = false): array
    {
        $craCheck = $this->craFetch->compareWithActive($this->ratesService);

        $config   = config('canada_gst_hst_rates');
        $payload  = $applyCraRates && ($craCheck['fetch']['fetched'] ?? false)
            ? $this->craFetch->mergeCraIntoConfig($craCheck['fetch']['provinces'])
            : $this->ratesService->configPayload();

        $versionLabel = $applyCraRates && ($craCheck['has_differences'] ?? false)
            ? ($config['version'] ?? 'config') . '-cra-' . now()->format('Y-m-d')
            : ($config['version'] ?? 'config');

        $checksum = md5(json_encode($payload));
        $active   = GstHstRateVersion::active();

        $result = [
            'rates_updated'         => false,
            'version'               => $versionLabel,
            'cra_check'             => $craCheck,
            'applied_cra_rates'     => $applyCraRates,
            'government_pages_changed' => (bool) ($craCheck['has_differences'] ?? false),
        ];

        if (! $active
            || $active->version !== $versionLabel
            || $active->source_checksum !== $checksum
            || ($applyCraRates && ($craCheck['has_differences'] ?? false))
        ) {
            GstHstRateVersion::where('is_active', true)->update(['is_active' => false]);

            GstHstRateVersion::updateOrCreate(
                ['version' => $versionLabel],
                [
                    'effective_date'           => $config['effective_date'],
                    'rates'                    => $payload,
                    'source_checksum'          => $checksum,
                    'is_active'                => true,
                    'government_pages_changed' => (bool) ($craCheck['has_differences'] ?? false),
                    'changelog'                => $applyCraRates
                        ? 'Rates applied from CRA charge & collect page.'
                        : ($config['changelog'] ?? null),
                    'last_synced_at'           => now(),
                ]
            );

            $result['rates_updated'] = true;
        } else {
            $active->update([
                'last_synced_at'           => now(),
                'government_pages_changed' => (bool) ($craCheck['has_differences'] ?? false),
            ]);
        }

        return $result;
    }

    /** @return array<string, mixed> */
    public function craStatus(): array
    {
        return $this->craFetch->compareWithActive($this->ratesService);
    }
}

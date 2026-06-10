<?php

namespace App\Services;

use App\Models\GstHstRateVersion;

class GstHstSyncService
{
    public function __construct(private GstHstRatesService $ratesService) {}

    public function sync(): array
    {
        $config   = config('canada_gst_hst_rates');
        $checksum = md5(json_encode($config));
        $active   = GstHstRateVersion::active();

        $result = [
            'rates_updated' => false,
            'version'       => $config['version'],
        ];

        $payload = [
            'federal_gst_rate' => $config['federal_gst_rate'],
            'provinces'        => $config['provinces'],
        ];

        if (! $active || $active->version !== $config['version'] || $active->source_checksum !== $checksum) {
            if ($active) {
                $active->update(['is_active' => false]);
            }

            GstHstRateVersion::create([
                'version'                    => $config['version'],
                'effective_date'             => $config['effective_date'],
                'rates'                      => $payload,
                'source_checksum'            => $checksum,
                'is_active'                  => true,
                'government_pages_changed'   => false,
                'changelog'                  => $config['changelog'] ?? null,
                'last_synced_at'             => now(),
            ]);

            $result['rates_updated'] = true;
        } else {
            $active->update(['last_synced_at' => now()]);
        }

        return $result;
    }
}

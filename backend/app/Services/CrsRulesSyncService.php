<?php

namespace App\Services;

use App\Models\CrsRuleVersion;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CrsRulesSyncService
{
    public function __construct(private CrsRulesService $rulesService) {}

    /**
     * Sync CRS rules from config into DB if version changed; probe IRCC for updates.
     */
    public function sync(): array
    {
        $config = config('crs_rules');
        $checksum = md5(json_encode($config));
        $active   = CrsRuleVersion::active();

        $result = [
            'rules_updated'   => false,
            'version'         => $config['version'],
            'draws_synced'    => 0,
            'ircc_probe'      => null,
        ];

        if (! $active || $active->version !== $config['version'] || $active->source_checksum !== $checksum) {
            if ($active) {
                $active->update(['is_active' => false]);
            }

            CrsRuleVersion::create([
                'version'          => $config['version'],
                'effective_date'   => $config['effective_date'],
                'rules'            => $this->extractRulesPayload($config),
                'source_url'       => $config['source_url'],
                'source_checksum'  => $checksum,
                'is_active'        => true,
                'changelog'        => $config['changelog'] ?? null,
                'last_synced_at'   => now(),
            ]);

            $result['rules_updated'] = true;
        } else {
            $active->update(['last_synced_at' => now()]);
        }

        $result['ircc_probe'] = $this->probeIrccSource($config['source_url'] ?? '');
        $result['draws_synced'] = app(CrsDrawSyncService::class)->sync();

        return $result;
    }

    private function extractRulesPayload(array $config): array
    {
        $keys = array_diff(array_keys($config), ['version', 'effective_date', 'source_url', 'official_tool', 'changelog', 'draw_sync']);

        return array_intersect_key($config, array_flip($keys));
    }

    private function probeIrccSource(string $url): ?array
    {
        if ($url === '') {
            return null;
        }

        try {
            $response = Http::timeout(15)->get($url);
            if (! $response->successful()) {
                return ['status' => 'unreachable', 'http' => $response->status()];
            }

            $body = $response->body();
            $hash = md5($body);

            return [
                'status'      => 'ok',
                'content_hash'=> $hash,
                'checked_at'  => now()->toIso8601String(),
                'note'        => 'If IRCC page content changes materially, review config/crs_rules.php and bump version.',
            ];
        } catch (\Throwable $e) {
            Log::warning('CRS IRCC probe failed: '.$e->getMessage());

            return ['status' => 'error', 'message' => $e->getMessage()];
        }
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TaxRateVersion;
use App\Services\CanadaTaxCalculatorService;
use App\Services\CanadaTaxRatesService;
use App\Services\CanadaTaxSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminCanadaTaxController extends Controller
{
    /** GET /api/v1/admin/canada-tax/sync-status */
    public function syncStatus(CanadaTaxRatesService $rates): JsonResponse
    {
        $config = config('canada_tax_rates');
        $active = TaxRateVersion::active();

        $history = TaxRateVersion::orderByDesc('effective_date')
            ->orderByDesc('id')
            ->limit(8)
            ->get()
            ->map(fn (TaxRateVersion $v) => [
                'id'                         => $v->id,
                'version'                    => $v->version,
                'tax_year'                   => $v->tax_year,
                'effective_date'             => $v->effective_date->format('Y-m-d'),
                'is_active'                  => $v->is_active,
                'government_pages_changed'   => $v->government_pages_changed,
                'changelog'                  => $v->changelog,
                'last_synced_at'             => $v->last_synced_at?->toIso8601String(),
            ]);

        return response()->json([
            'meta'                => $rates->meta(),
            'config_version'      => $config['version'] ?? null,
            'config_checksum'     => md5(json_encode($config)),
            'active_checksum'     => $active?->source_checksum,
            'rates_in_db'         => (bool) $active,
            'province_count'      => count($config['provinces'] ?? []),
            'source_probes'       => $active?->source_probes ?? [],
            'auto_sync'           => [
                'command'     => 'tax:sync',
                'schedule'    => 'Daily at 6:00 AM (America/Toronto)',
                'description' => 'Syncs tax brackets from config and probes CRA canada.ca pages for rate changes.',
            ],
            'source_urls'         => $config['source_urls'] ?? [],
            'version_history'     => $history,
            'rates_tables'        => $rates->formattedTables(),
            'sample_calculation'  => app(CanadaTaxCalculatorService::class)->calculate(75000, 'ON'),
        ]);
    }

    /** POST /api/v1/admin/canada-tax/sync */
    public function sync(CanadaTaxSyncService $syncService, CanadaTaxRatesService $rates): JsonResponse
    {
        $result = $syncService->sync();

        $message = 'Canada tax sync completed.';
        if ($result['rates_updated'] ?? false) {
            $message = 'Tax rates updated to version '.($result['version'] ?? 'unknown').'.';
        } elseif ($result['government_pages_changed'] ?? false) {
            $message = 'CRA pages changed — review config and bump version if rates need updating.';
        }

        return response()->json([
            'message' => $message,
            'result'  => $result,
            'meta'    => $rates->meta(),
        ]);
    }

    /** POST /api/v1/admin/canada-tax/calculate */
    public function calculate(Request $request, CanadaTaxCalculatorService $calculator): JsonResponse
    {
        $data = $request->validate([
            'annual_income' => 'required|numeric|min:0|max:10000000',
            'province'      => 'required|string|size:2',
        ]);

        try {
            return response()->json([
                'result' => $calculator->calculate((float) $data['annual_income'], $data['province']),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}

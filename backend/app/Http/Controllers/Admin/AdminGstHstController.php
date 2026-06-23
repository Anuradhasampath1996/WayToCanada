<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GstHstRateVersion;
use App\Services\GstHstCalculatorService;
use App\Services\GstHstRatesService;
use App\Services\GstHstSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminGstHstController extends Controller
{
    public function syncStatus(GstHstRatesService $rates, GstHstCalculatorService $calculator, GstHstSyncService $syncService): JsonResponse
    {
        $config = config('canada_gst_hst_rates');
        $active = GstHstRateVersion::active();
        $cra    = $syncService->craStatus();

        $history = GstHstRateVersion::orderByDesc('effective_date')
            ->orderByDesc('id')
            ->limit(6)
            ->get()
            ->map(fn (GstHstRateVersion $v) => [
                'id'                       => $v->id,
                'version'                  => $v->version,
                'effective_date'           => $v->effective_date->format('Y-m-d'),
                'is_active'                => $v->is_active,
                'government_pages_changed' => $v->government_pages_changed,
                'last_synced_at'           => $v->last_synced_at?->toIso8601String(),
            ]);

        return response()->json([
            'meta'              => $rates->meta(),
            'config_version'    => $config['version'] ?? null,
            'rates_in_db'       => (bool) $active,
            'province_count'    => count($config['provinces'] ?? []),
            'rates_table'       => $rates->formattedTable(),
            'cra_check'         => $cra,
            'auto_sync'         => [
                'command'     => 'gst-hst:sync',
                'schedule'    => 'Daily at 6:30 AM (America/Toronto)',
                'description' => 'Syncs GST/HST/PST rates and checks CRA charge & collect page for changes.',
            ],
            'version_history'   => $history,
            'sample_calculation'=> $calculator->calculate(100, 'ON'),
        ]);
    }

    public function sync(Request $request, GstHstSyncService $syncService, GstHstRatesService $rates): JsonResponse
    {
        $applyCra = $request->boolean('apply_cra_rates');
        $result   = $syncService->sync($applyCra);

        $message = 'GST/HST sync completed.';
        if ($result['applied_cra_rates'] ?? false) {
            $message = 'GST/HST rates updated from CRA page.';
        } elseif ($result['rates_updated'] ?? false) {
            $message = 'GST/HST rates updated to version '.($result['version'] ?? '').'.';
        } elseif ($result['government_pages_changed'] ?? false) {
            $message = 'CRA page differs from active rates. Review differences or apply CRA rates.';
        }

        return response()->json([
            'message' => $message,
            'result'  => $result,
            'meta'    => $rates->meta(),
            'cra_check' => $result['cra_check'] ?? null,
        ]);
    }

    public function calculate(Request $request, GstHstCalculatorService $calculator): JsonResponse
    {
        $data = $request->validate([
            'subtotal' => 'required|numeric|min:0|max:10000000',
            'province' => 'required|string|size:2',
        ]);

        try {
            return response()->json([
                'result' => $calculator->calculate((float) $data['subtotal'], $data['province']),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}

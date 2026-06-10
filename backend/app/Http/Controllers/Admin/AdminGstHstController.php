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
    public function syncStatus(GstHstRatesService $rates, GstHstCalculatorService $calculator): JsonResponse
    {
        $config = config('canada_gst_hst_rates');
        $active = GstHstRateVersion::active();

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
            'auto_sync'         => [
                'command'     => 'gst-hst:sync',
                'schedule'    => 'Daily at 6:30 AM (America/Toronto)',
                'description' => 'Syncs GST/HST/PST rates from config for payment tax.',
            ],
            'version_history'   => $history,
            'sample_calculation'=> $calculator->calculate(100, 'ON'),
        ]);
    }

    public function sync(GstHstSyncService $syncService, GstHstRatesService $rates): JsonResponse
    {
        $result = $syncService->sync();

        $message = 'GST/HST sync completed.';
        if ($result['rates_updated'] ?? false) {
            $message = 'GST/HST rates updated to version '.($result['version'] ?? '').'.';
        }

        return response()->json([
            'message' => $message,
            'result'  => $result,
            'meta'    => $rates->meta(),
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

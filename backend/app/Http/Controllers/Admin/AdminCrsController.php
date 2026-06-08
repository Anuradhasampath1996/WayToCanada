<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CrsRuleVersion;
use App\Models\ExpressEntryDraw;
use App\Services\CrsRulesService;
use App\Services\CrsRulesSyncService;
use Illuminate\Http\JsonResponse;

class AdminCrsController extends Controller
{
    /** GET /api/v1/admin/crs-calculator/sync-status */
    public function syncStatus(CrsRulesService $rules): JsonResponse
    {
        $config = config('crs_rules');
        $active = CrsRuleVersion::active();
        $latestDraw = ExpressEntryDraw::orderByDesc('draw_date')
            ->orderByDesc('draw_number')
            ->first();

        $versionHistory = CrsRuleVersion::orderByDesc('effective_date')
            ->orderByDesc('id')
            ->limit(8)
            ->get()
            ->map(fn (CrsRuleVersion $v) => [
                'id'             => $v->id,
                'version'        => $v->version,
                'effective_date' => $v->effective_date->format('Y-m-d'),
                'is_active'      => $v->is_active,
                'changelog'      => $v->changelog,
                'source_url'     => $v->source_url,
                'last_synced_at' => $v->last_synced_at?->toIso8601String(),
            ]);

        return response()->json([
            'meta'              => $rules->meta(),
            'config_version'    => $config['version'] ?? null,
            'config_checksum'   => md5(json_encode($config)),
            'active_checksum'   => $active?->source_checksum,
            'rules_in_db'       => (bool) $active,
            'draw_count'        => ExpressEntryDraw::count(),
            'latest_draw'       => $latestDraw ? [
                'draw_number'         => $latestDraw->draw_number,
                'draw_date'           => $latestDraw->draw_date->format('Y-m-d'),
                'minimum_crs_score'   => $latestDraw->minimum_crs_score,
                'invitations_issued'  => $latestDraw->invitations_issued,
                'round_type'          => $latestDraw->round_type,
                'draw_name'           => $latestDraw->draw_name,
            ] : null,
            'draws_updated_at'  => ExpressEntryDraw::max('updated_at'),
            'auto_sync'         => [
                'command'     => 'crs:sync',
                'schedule'    => 'Daily at 4:00 AM (America/Toronto)',
                'description' => 'Syncs CRS scoring rules from config (with IRCC page probe) and Express Entry draw cut-offs from open data.',
            ],
            'draw_sources'      => $config['draw_sync']['sources'] ?? [],
            'source_urls'       => [
                'crs_criteria'  => $config['source_url'] ?? null,
                'official_tool' => $config['official_tool'] ?? null,
            ],
            'policies'          => $config['policies'] ?? [],
            'version_history'   => $versionHistory,
            'recent_draws'      => ExpressEntryDraw::orderByDesc('draw_date')
                ->orderByDesc('draw_number')
                ->limit(10)
                ->get()
                ->map(fn (ExpressEntryDraw $d) => [
                    'draw_number'        => $d->draw_number,
                    'draw_date'          => $d->draw_date->format('Y-m-d'),
                    'minimum_crs_score'  => $d->minimum_crs_score,
                    'invitations_issued' => $d->invitations_issued,
                    'round_type'         => $d->round_type,
                    'draw_name'          => $d->draw_name,
                ]),
        ]);
    }

    /** POST /api/v1/admin/crs-calculator/sync */
    public function sync(CrsRulesSyncService $syncService, CrsRulesService $rules): JsonResponse
    {
        $result = $syncService->sync();

        $message = 'CRS calculator sync completed.';
        if ($result['rules_updated'] ?? false) {
            $message = 'CRS rules updated to version '.($result['version'] ?? 'unknown').'.';
        }

        return response()->json([
            'message' => $message,
            'result'  => $result,
            'meta'    => $rules->meta(),
        ]);
    }
}

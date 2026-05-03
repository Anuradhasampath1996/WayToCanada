<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\RcicConsultant;
use Illuminate\Http\JsonResponse;

class AdminStatsController extends Controller
{
    /**
     * GET /api/v1/admin/stats
     * Returns overview counts for the super admin dashboard.
     */
    public function index(): JsonResponse
    {
        $userCounts = User::selectRaw('COUNT(*) as total')
            ->addSelect([
                \DB::raw('SUM(is_verified = 1) as verified'),
                \DB::raw('SUM(is_verified = 0) as unverified'),
            ])
            ->first();

        // Role counts via Spatie (pivot table on cws)
        $roleCounts = \DB::connection('cws')
            ->table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->selectRaw('roles.name as role, COUNT(*) as total')
            ->groupBy('roles.name')
            ->pluck('total', 'role');

        $rcicStats = RcicConsultant::selectRaw(
            'COUNT(*) as total,
             SUM(entitled_to_practise = 1) as active,
             SUM(entitled_to_practise = 0) as inactive'
        )->first();

        return response()->json([
            'users' => [
                'total'      => (int) $userCounts->total,
                'verified'   => (int) $userCounts->verified,
                'unverified' => (int) $userCounts->unverified,
                'by_role'    => [
                    'super_admin' => (int) ($roleCounts['super-admin'] ?? 0),
                    'admin'       => (int) ($roleCounts['admin']       ?? 0),
                    'rcic'        => (int) ($roleCounts['rcic']        ?? 0),
                    'client'      => (int) ($roleCounts['client']      ?? 0),
                ],
            ],
            'rcic_register' => [
                'total'    => (int) $rcicStats->total,
                'active'   => (int) $rcicStats->active,
                'inactive' => (int) $rcicStats->inactive,
            ],
        ]);
    }
}

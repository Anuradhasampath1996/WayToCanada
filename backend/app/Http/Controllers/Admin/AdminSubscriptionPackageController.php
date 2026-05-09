<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSubscriptionPackageController extends Controller
{
    /** GET /api/v1/admin/subscription-packages */
    public function index(): JsonResponse
    {
        $packages = SubscriptionPackage::orderBy('sort_order')->orderBy('id')->get();
        return response()->json(['data' => $packages]);
    }

    /** POST /api/v1/admin/subscription-packages */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'          => 'required|string|max:255',
            'description'   => 'nullable|string',
            'monthly_price' => 'nullable|numeric|min:0',
            'yearly_price'  => 'nullable|numeric|min:0',
            'features'      => 'nullable|array',
            'features.*'    => 'string|max:255',
            'is_active'     => 'boolean',
            'sort_order'    => 'integer',
        ]);

        $package = SubscriptionPackage::create($data);
        return response()->json(['data' => $package, 'message' => 'Package created.'], 201);
    }

    /** GET /api/v1/admin/subscription-packages/{package} */
    public function show(SubscriptionPackage $package): JsonResponse
    {
        return response()->json(['data' => $package]);
    }

    /** PUT /api/v1/admin/subscription-packages/{package} */
    public function update(Request $request, SubscriptionPackage $package): JsonResponse
    {
        $data = $request->validate([
            'name'          => 'required|string|max:255',
            'description'   => 'nullable|string',
            'monthly_price' => 'nullable|numeric|min:0',
            'yearly_price'  => 'nullable|numeric|min:0',
            'features'      => 'nullable|array',
            'features.*'    => 'string|max:255',
            'is_active'     => 'boolean',
            'sort_order'    => 'integer',
        ]);

        $package->update($data);
        return response()->json(['data' => $package, 'message' => 'Package updated.']);
    }

    /** PATCH /api/v1/admin/subscription-packages/{package}/toggle */
    public function toggle(SubscriptionPackage $package): JsonResponse
    {
        $package->update(['is_active' => !$package->is_active]);
        return response()->json([
            'data'    => $package,
            'message' => 'Package ' . ($package->is_active ? 'activated' : 'deactivated') . '.',
        ]);
    }

    /** DELETE /api/v1/admin/subscription-packages/{package} */
    public function destroy(SubscriptionPackage $package): JsonResponse
    {
        $package->delete();
        return response()->json(['message' => 'Package deleted.']);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\StorageAddonPackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminStorageAddonPackageController extends Controller
{
    public function index(): JsonResponse
    {
        $packages = StorageAddonPackage::orderBy('sort_order')->orderBy('id')->get();

        return response()->json(['data' => $packages]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $package = StorageAddonPackage::create($data);

        return response()->json(['data' => $package, 'message' => 'Storage package created.'], 201);
    }

    public function show(StorageAddonPackage $storageAddonPackage): JsonResponse
    {
        return response()->json(['data' => $storageAddonPackage]);
    }

    public function update(Request $request, StorageAddonPackage $storageAddonPackage): JsonResponse
    {
        $data = $this->validated($request);
        $storageAddonPackage->update($data);

        return response()->json(['data' => $storageAddonPackage, 'message' => 'Storage package updated.']);
    }

    public function toggle(StorageAddonPackage $storageAddonPackage): JsonResponse
    {
        $storageAddonPackage->update(['is_active' => ! $storageAddonPackage->is_active]);

        return response()->json([
            'data'    => $storageAddonPackage,
            'message' => 'Package ' . ($storageAddonPackage->is_active ? 'activated' : 'deactivated') . '.',
        ]);
    }

    public function destroy(StorageAddonPackage $storageAddonPackage): JsonResponse
    {
        $storageAddonPackage->delete();

        return response()->json(['message' => 'Storage package deleted.']);
    }

    /** Public list for consultants */
    public function publicIndex(): JsonResponse
    {
        $packages = StorageAddonPackage::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $packages]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name'          => 'required|string|max:255',
            'description'   => 'nullable|string',
            'extra_gb'      => 'required|integer|min:1|max:1000',
            'monthly_price' => 'nullable|numeric|min:0',
            'yearly_price'  => 'nullable|numeric|min:0',
            'is_active'     => 'boolean',
            'sort_order'    => 'integer',
        ]);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ImmigrationConsultant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminImmigrationConsultantController extends Controller
{
    /**
     * GET /api/v1/admin/immigration-consultants
     * Paginated list with optional search and active filter.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search'   => 'nullable|string|max:100',
            'active'   => 'nullable|boolean',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $query = ImmigrationConsultant::query();

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('company', 'like', "%{$search}%")
                  ->orWhere('city', 'like', "%{$search}%");
            });
        }

        if ($request->filled('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        $records = $query->latest()->paginate($request->input('per_page', 20));

        return response()->json($records);
    }

    /**
     * POST /api/v1/admin/immigration-consultants
     * Create a new entry.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'           => 'required|string|max:255',
            'email'          => 'nullable|email|max:255',
            'phone'          => 'nullable|string|max:50',
            'company'        => 'nullable|string|max:255',
            'city'           => 'nullable|string|max:100',
            'province'       => 'nullable|string|max:100',
            'country'        => 'nullable|string|max:100',
            'specialization' => 'nullable|string|max:255',
            'notes'          => 'nullable|string',
            'is_active'      => 'nullable|boolean',
        ]);

        $consultant = ImmigrationConsultant::create($data);

        return response()->json(['message' => 'Created.', 'data' => $consultant], 201);
    }

    /**
     * GET /api/v1/admin/immigration-consultants/{id}
     */
    public function show(ImmigrationConsultant $immigrationConsultant): JsonResponse
    {
        return response()->json($immigrationConsultant);
    }

    /**
     * PUT /api/v1/admin/immigration-consultants/{id}
     */
    public function update(Request $request, ImmigrationConsultant $immigrationConsultant): JsonResponse
    {
        $data = $request->validate([
            'name'           => 'required|string|max:255',
            'email'          => 'nullable|email|max:255',
            'phone'          => 'nullable|string|max:50',
            'company'        => 'nullable|string|max:255',
            'city'           => 'nullable|string|max:100',
            'province'       => 'nullable|string|max:100',
            'country'        => 'nullable|string|max:100',
            'specialization' => 'nullable|string|max:255',
            'notes'          => 'nullable|string',
            'is_active'      => 'nullable|boolean',
        ]);

        $immigrationConsultant->update($data);

        return response()->json(['message' => 'Updated.', 'data' => $immigrationConsultant]);
    }

    /**
     * DELETE /api/v1/admin/immigration-consultants/{id}
     */
    public function destroy(ImmigrationConsultant $immigrationConsultant): JsonResponse
    {
        $immigrationConsultant->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}

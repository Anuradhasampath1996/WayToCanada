<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class AdminUsersController extends Controller
{
    /**
     * GET /api/v1/admin/users
     * Paginated, filterable user list.
     *
     * Query params:
     *   search  — name or email substring
     *   role    — super-admin | admin | rcic | client
     *   verified — 1 | 0
     *   per_page — default 20, max 100
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'search'   => 'nullable|string|max:100',
            'role'     => 'nullable|string|in:super-admin,admin,rcic,client',
            'verified' => 'nullable|boolean',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $query = User::with('roles');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($role = $request->input('role')) {
            $query->role($role, 'sanctum');   // Spatie scope
        }

        if ($request->filled('verified')) {
            $query->where('is_verified', $request->boolean('verified'));
        }

        $users = $query->latest()->paginate($request->input('per_page', 20));

        return UserResource::collection($users);
    }

    /**
     * GET /api/v1/admin/users/{id}
     */
    public function show(User $user): UserResource
    {
        $user->load('roles');
        return new UserResource($user);
    }

    /**
     * PATCH /api/v1/admin/users/{id}/role
     * Replaces the user's role with a single new role.
     * Body: { "role": "rcic" }
     */
    public function updateRole(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::in(['super-admin', 'admin', 'rcic', 'client'])],
        ]);

        $user->syncRoles([$data['role']]);

        return response()->json([
            'message' => 'Role updated.',
            'user'    => new UserResource($user->fresh('roles')),
        ]);
    }

    /**
     * PATCH /api/v1/admin/users/{id}/toggle
     * Flips the is_verified flag (activate / deactivate the account).
     */
    public function toggleVerified(User $user): JsonResponse
    {
        $user->update(['is_verified' => ! $user->is_verified]);

        return response()->json([
            'message'     => $user->is_verified ? 'User activated.' : 'User deactivated.',
            'is_verified' => $user->is_verified,
        ]);
    }

    /**
     * POST /api/v1/admin/users
     * Create a new admin user.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:cws.users,email',
            'password' => 'required|string|min:8',
            'role'     => ['required', Rule::in(['super-admin', 'admin', 'rcic', 'client'])],
        ]);

        $user = User::create([
            'name'        => $data['name'],
            'email'       => $data['email'],
            'password'    => \Illuminate\Support\Facades\Hash::make($data['password']),
            'is_verified' => true,
        ]);

        $user->assignRole($data['role']);

        return response()->json([
            'message' => 'User created.',
            'user'    => new UserResource($user->fresh('roles')),
        ], 201);
    }

    /**
     * PUT /api/v1/admin/users/{id}
     * Update name, email, optional password and role.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => ['required', 'email', Rule::unique('cws.users', 'email')->ignore($user->id)],
            'password' => 'nullable|string|min:8',
            'role'     => ['required', Rule::in(['super-admin', 'admin', 'rcic', 'client'])],
        ]);

        $user->name  = $data['name'];
        $user->email = $data['email'];
        if (!empty($data['password'])) {
            $user->password = \Illuminate\Support\Facades\Hash::make($data['password']);
        }
        $user->save();

        $user->syncRoles([$data['role']]);

        return response()->json([
            'message' => 'User updated.',
            'user'    => new UserResource($user->fresh('roles')),
        ]);
    }

    /**
     * DELETE /api/v1/admin/users/{id}
     * Delete a user (cannot delete yourself).
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'Cannot delete your own account.'], 403);
        }

        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }
}

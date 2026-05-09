<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rules\Password;

class PublicRegisterController extends Controller
{
    /**
     * POST /api/v1/auth/register
     *
     * Registers a new public (client) user and sends a verification email.
     */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name'  => ['required', 'string', 'max:100'],
            'email'      => ['required', 'email:rfc', 'max:255', 'unique:cws.users,email'],
            'phone'      => ['nullable', 'string', 'max:30'],
            'password'   => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);

        $user = User::create([
            'name'     => trim($data['first_name'] . ' ' . $data['last_name']),
            'email'    => $data['email'],
            'phone'    => $data['phone'] ?? null,
            'password' => Hash::make($data['password']),
            'locale'   => 'en',
        ]);

        $user->assignRole('client');

        // Send Laravel's built-in verification email
        $user->sendEmailVerificationNotification();

        $token = $user->createToken('password-auth')->plainTextToken;

        return response()->json([
            'message' => 'Registration successful. Please check your email to verify your account.',
            'token'   => $token,
            'user'    => new UserResource($user->load('roles')),
        ], 201);
    }

    /**
     * GET /api/v1/auth/public/email/verify/{id}/{hash}
     *
     * Verifies the signed email link for public users.
     * Redirects to the public login page with ?verified=1.
     */
    public function verifyEmail(Request $request, int $id, string $hash): RedirectResponse
    {
        $user = User::findOrFail($id);

        if (! hash_equals((string) $hash, sha1($user->getEmailForVerification()))) {
            abort(403, 'Invalid verification link.');
        }

        if (! URL::hasValidSignature($request)) {
            abort(403, 'Verification link has expired or is invalid.');
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
            event(new Verified($user));
        }

        if (! $user->is_verified) {
            $user->update(['is_verified' => true]);
        }

        $publicUrl = rtrim(env('PUBLIC_FRONTEND_URL', 'http://localhost:3002'), '/');
        return redirect("{$publicUrl}/login?verified=1");
    }
}

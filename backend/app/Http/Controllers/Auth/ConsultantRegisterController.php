<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rules\Password;

class ConsultantRegisterController extends Controller
{
    /**
     * POST /api/v1/auth/register/consultant
     *
     * Creates a new consultant (rcic) account and sends a verification email.
     */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name'  => ['required', 'string', 'max:100'],
            'email'      => ['required', 'email:rfc,dns', 'max:255', 'unique:cws.users,email'],
            'phone'      => ['required', 'string', 'max:30'],
            'password'   => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);

        $user = User::create([
            'name'     => trim($data['first_name'] . ' ' . $data['last_name']),
            'email'    => $data['email'],
            'phone'    => $data['phone'],
            'password' => Hash::make($data['password']),
            'locale'   => 'en',
        ]);

        $user->assignRole('rcic');

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
     * GET /api/v1/auth/email/verify/{id}/{hash}
     *
     * Verifies the signed email link. On success, redirects to the consultant
     * login page with ?verified=1 so the frontend can show a success notice.
     */
    public function verifyEmail(Request $request, int $id, string $hash): RedirectResponse
    {
        $user = User::findOrFail($id);

        // Validate the signed URL
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

        // Keep is_verified in sync with email_verified_at
        if (! $user->is_verified) {
            $user->update(['is_verified' => true]);
        }

        return redirect(env('CONSULTANT_FRONTEND_URL', 'http://localhost:3001') . '/login?verified=1');
    }

    /**
     * POST /api/v1/auth/email/resend
     *
     * Resends the verification email to the authenticated user.
     */
    public function resendVerification(Request $request): JsonResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email already verified.'], 200);
        }

        $request->user()->sendEmailVerificationNotification();

        return response()->json(['message' => 'Verification email sent.'], 200);
    }

    /**
     * GET /api/v1/auth/google/consultant/redirect
     *
     * Initiates Google OAuth for consultant registration.
     * The `state` parameter tells the callback to assign the 'rcic' role.
     */
    public function googleRedirect(): JsonResponse
    {
        $url = \Laravel\Socialite\Facades\Socialite::driver('google')
            ->stateless()
            ->with(['state' => 'consultant'])
            ->redirect()
            ->getTargetUrl();

        return response()->json(['redirect_url' => $url]);
    }
}

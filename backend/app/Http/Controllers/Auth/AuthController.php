<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Auth\MobileOAuthStateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{
    /**
     * POST /api/v1/auth/login
     * Email + password login. Returns a Sanctum token.
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'    => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'max:255'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if ($user && ! $user->hasPassword()) {
            $providers = $user->authProviders();
            $hint = in_array('google', $providers, true)
                ? 'This account was created with Google. Sign in with Google, or use “Forgot password” to create a password for email login.'
                : 'This account has no password yet. Sign in with your linked provider or use “Forgot password” to set one.';

            return response()->json([
                'message' => $hint,
                'code' => 'oauth_only',
                'auth_providers' => $providers,
                'errors' => ['email' => [$hint]],
            ], 422);
        }

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_verified) {
            return response()->json([
                'message' => 'Your account has been deactivated. Please contact your consultant.',
            ], 403);
        }

        // Revoke old password-login tokens and issue a fresh one
        $user->tokens()->where('name', 'password-auth')->delete();
        $token = $user->createToken('password-auth')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => new UserResource($user->load('roles')),
        ]);
    }

    /**
     * GET /api/v1/auth/google/mobile/redirect?return_to=...&intent=client|consultant
     * Starts Google OAuth for Flutter / mobile clients; callback returns to return_to with ?token=
     */
    public function redirectToGoogleMobile(Request $request, MobileOAuthStateService $mobileOAuth): JsonResponse
    {
        return response()->json([
            'redirect_url' => $this->googleMobileRedirectUrl($request, $mobileOAuth),
        ]);
    }

    /**
     * GET /api/v1/auth/google/mobile/start?return_to=...&intent=client|consultant
     * Browser redirect (Flutter web) — avoids CORS preflight on the OAuth start step.
     */
    public function redirectToGoogleMobileStart(Request $request, MobileOAuthStateService $mobileOAuth)
    {
        return redirect()->away($this->googleMobileRedirectUrl($request, $mobileOAuth));
    }

    private function googleMobileRedirectUrl(Request $request, MobileOAuthStateService $mobileOAuth): string
    {
        $data = $request->validate([
            'return_to' => ['required', 'string', 'max:2048'],
            'intent'    => ['sometimes', 'in:client,consultant'],
        ]);

        if (! $mobileOAuth->isAllowedReturnTo($data['return_to'])) {
            abort(422, 'Invalid return URL for mobile OAuth.');
        }

        $state = $mobileOAuth->issue($data['return_to'], $data['intent'] ?? 'client');

        return Socialite::driver('google')
            ->stateless()
            ->with(['state' => $state])
            ->redirect()
            ->getTargetUrl();
    }

    /**
     * Redirect the user to Google's OAuth page.
     */
    public function redirectToGoogle(): JsonResponse
    {
        $url = Socialite::driver('google')
            ->stateless()
            ->redirect()
            ->getTargetUrl();

        return response()->json(['redirect_url' => $url]);
    }

    /**
     * Handle the Google OAuth callback.
     * Creates or fetches the user, assigns default role, issues Sanctum token.
     */
    public function handleGoogleCallback(Request $request)
    {
        $googleUser = Socialite::driver('google')->stateless()->user();

        $state = $request->query('state');
        $mobileOAuth = app(MobileOAuthStateService::class);
        $mobile = is_string($state) ? $mobileOAuth->consume($state) : null;
        $isConsultantRegister = $state === 'consultant';
        $isConsultantLogin    = $state === 'consultant-login' || ($mobile && $mobile['intent'] === 'consultant');

        // Try to find by google_id first, then fall back to email (handles
        // users who registered manually and are now linking their Google account).
        $user = User::where('google_id', $googleUser->getId())->first()
            ?? User::where('email', $googleUser->getEmail())->first();

        if ($user) {
            // Link Google ID and update avatar/verification if not already set
            $updates = [];
            if (! $user->google_id)          $updates['google_id']         = $googleUser->getId();
            if (! $user->avatar)             $updates['avatar']             = $googleUser->getAvatar();
            if (! $user->email_verified_at)  $updates['email_verified_at'] = now();
            if (! $user->is_verified)        $updates['is_verified']        = true;
            if ($updates) $user->update($updates);
        } else {
            $user = User::create([
                'google_id'         => $googleUser->getId(),
                'name'              => $googleUser->getName(),
                'email'             => $googleUser->getEmail(),
                'avatar'            => $googleUser->getAvatar(),
                'email_verified_at' => now(),
                'is_verified'       => true,
                'locale'            => 'en',
            ]);
        }

        // Assign role to new users only
        if (! $user->hasAnyRole(['rcic', 'client', 'admin', 'super-admin'])) {
            $user->assignRole(($isConsultantRegister || $isConsultantLogin) ? 'rcic' : 'client');
        }

        $user->tokens()->where('name', 'google-auth')->delete();
        $token = $user->createToken('google-auth')->plainTextToken;

        if ($mobile) {
            return $this->redirectMobileWithToken($mobile['return_to'], $token);
        }

        // consultant login → go straight to consultant dashboard via auth/callback
        if ($isConsultantLogin) {
            $dashboardUrl = rtrim(env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/');
            return redirect()->away("{$dashboardUrl}/auth/callback#token={$token}");
        }

        // consultant register → go to Consultant Website auth/callback (shows registered banner)
        if ($isConsultantRegister) {
            $frontendUrl = rtrim(env('CONSULTANT_FRONTEND_URL', 'http://localhost:3002'), '/');
            return redirect()->away("{$frontendUrl}/auth/callback#token={$token}");
        }

        // Default: public/client portal
        $frontendUrl = rtrim(env('PUBLIC_FRONTEND_URL', 'http://localhost:3003'), '/');
        return redirect()->away("{$frontendUrl}/auth/callback#token={$token}");
    }

    /**
     * Redirect consultant to Google OAuth for LOGIN (state=consultant-login).
     */
    public function redirectToGoogleConsultantLogin(): JsonResponse
    {
        $url = Socialite::driver('google')
            ->stateless()
            ->with(['state' => 'consultant-login'])
            ->redirect()
            ->getTargetUrl();

        return response()->json(['redirect_url' => $url]);
    }

    /**
     * Redirect public user to GitHub OAuth.
     */
    public function redirectToGithubPublic(): JsonResponse
    {
        $url = Socialite::driver('github')
            ->stateless()
            ->redirect()
            ->getTargetUrl();

        return response()->json(['redirect_url' => $url]);
    }

    /**
     * Redirect consultant to GitHub OAuth for LOGIN (state=consultant-login).
     */
    public function redirectToGithubConsultantLogin(): JsonResponse
    {
        $url = Socialite::driver('github')
            ->stateless()
            ->with(['state' => 'consultant-login'])
            ->redirect()
            ->getTargetUrl();

        return response()->json(['redirect_url' => $url]);
    }

    /**
     * Handle GitHub OAuth callback.
     */
    public function handleGithubCallback(Request $request)
    {
        $githubUser = Socialite::driver('github')->stateless()->user();

        $state             = $request->query('state');
        $isConsultantLogin = $state === 'consultant-login';

        // Match by github_id first, then fall back to email
        $user = User::where('github_id', $githubUser->getId())->first();

        if (! $user && $githubUser->getEmail()) {
            $user = User::where('email', $githubUser->getEmail())->first();
            if ($user) {
                $user->update(['github_id' => $githubUser->getId()]);
            }
        }

        if (! $user) {
            $user = User::create([
                'github_id'         => $githubUser->getId(),
                'name'              => $githubUser->getName() ?? $githubUser->getNickname(),
                'email'             => $githubUser->getEmail(),
                'avatar'            => $githubUser->getAvatar(),
                'email_verified_at' => now(),
                'is_verified'       => true,
                'locale'            => 'en',
            ]);
        }

        // Ensure existing GitHub users also have is_verified set
        if (! $user->is_verified) {
            $user->update(['is_verified' => true, 'email_verified_at' => $user->email_verified_at ?? now()]);
        }

        // Assign role to new users only
        if (! $user->hasAnyRole(['rcic', 'client', 'admin', 'super-admin'])) {
            $user->assignRole($isConsultantLogin ? 'rcic' : 'client');
        }

        $user->tokens()->where('name', 'github-auth')->delete();
        $token = $user->createToken('github-auth')->plainTextToken;

        if ($isConsultantLogin) {
            $dashboardUrl = rtrim(env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/');
            return redirect()->away("{$dashboardUrl}/dashboard/login?sso=" . urlencode($token));
        }

        $frontendUrl = rtrim(env('PUBLIC_FRONTEND_URL', 'http://localhost:3003'), '/');
        return redirect()->away("{$frontendUrl}/auth/callback#token={$token}");
    }

    /**
     * Return the currently authenticated user.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json(new UserResource($request->user()));
    }

    /**
     * Revoke the current access token (logout).
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    /**
     * POST /api/v1/auth/set-password
     * Set or change password while authenticated (e.g. after Google sign-in).
     */
    public function setPassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $rules = [
            'password' => ['required', 'confirmed', PasswordRule::min(8)->max(255)],
        ];

        if ($user->hasPassword()) {
            $rules['current_password'] = ['required', 'string'];
        }

        $data = $request->validate($rules);

        if ($user->hasPassword() && ! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $hadPassword = $user->hasPassword();
        $user->update(['password' => $data['password']]);

        return response()->json([
            'message' => $hadPassword
                ? 'Password updated.'
                : 'Password saved. You can now sign in with email and password.',
            'user' => new UserResource($user->load('roles')),
        ]);
    }

    /**
     * POST /api/v1/auth/forgot-password
     * Send a password reset link (works for Google-only accounts too).
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        Password::sendResetLink(['email' => $data['email']]);

        return response()->json([
            'message' => 'If that email is registered, we sent password reset instructions.',
        ]);
    }

    /**
     * POST /api/v1/auth/reset-password
     * Complete password reset from email link.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token'                 => ['required', 'string'],
            'email'                 => ['required', 'email', 'max:255'],
            'password'              => ['required', 'confirmed', PasswordRule::min(8)->max(255)],
        ]);

        $status = Password::reset(
            $data,
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        return response()->json([
            'message' => 'Password reset successfully. You can now sign in with your email and password.',
        ]);
    }

    private function redirectMobileWithToken(string $returnTo, string $token)
    {
        $encoded = urlencode($token);

        // Hash-route apps (Flutter web): keep token inside the fragment.
        if (str_contains($returnTo, '#')) {
            [$base, $fragment] = explode('#', $returnTo, 2);
            $separator = str_contains($fragment, '?') ? '&' : '?';

            return redirect()->away($base . '#' . $fragment . $separator . 'token=' . $encoded);
        }

        $separator = str_contains($returnTo, '?') ? '&' : '?';

        return redirect()->away($returnTo . $separator . 'token=' . $encoded);
    }
}

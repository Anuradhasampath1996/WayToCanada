<?php

namespace App\Providers;

use App\Services\IntegrationSettingsService;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use SocialiteProviders\Manager\SocialiteWasCalled;
use SocialiteProviders\Google\GoogleExtendSocialite;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Register the Google Socialite provider
        Event::listen(SocialiteWasCalled::class, GoogleExtendSocialite::class);

        try {
            app(IntegrationSettingsService::class)->applyRuntimeConfig();
        } catch (\Throwable) {
            // DB may be unavailable during initial migrate
        }

        ResetPassword::createUrlUsing(function (object $user, string $token) {
            $base = rtrim(
                $user instanceof \App\Models\User && $user->hasRole('rcic')
                    ? env('CONSULTANT_FRONTEND_URL', 'http://localhost:3002')
                    : env('PUBLIC_FRONTEND_URL', 'http://localhost:3000'),
                '/'
            );

            return $base.'/reset-password?'.http_build_query([
                'token' => $token,
                'email' => $user->getEmailForPasswordReset(),
            ]);
        });
    }
}

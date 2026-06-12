<?php

namespace App\Providers;

use App\Services\IntegrationSettingsService;
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
    }
}

<?php

namespace App\Providers;

use App\Contracts\GovernmentForms\GovernmentPdfEngine;
use App\Implementations\GovernmentForms\JarGovernmentPdfEngine;
use App\Services\Email\EmailBrandingService;
use App\Services\IntegrationSettingsService;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use SocialiteProviders\Manager\SocialiteWasCalled;
use SocialiteProviders\Google\GoogleExtendSocialite;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(GovernmentPdfEngine::class, JarGovernmentPdfEngine::class);
    }

    public function boot(): void
    {
        Event::listen(SocialiteWasCalled::class, GoogleExtendSocialite::class);

        try {
            app(IntegrationSettingsService::class)->applyRuntimeConfig();
        } catch (\Throwable) {
            // DB may be unavailable during initial migrate
        }

        $resetUrl = function (object $user, string $token): string {
            $base = rtrim(
                $user instanceof \App\Models\User && method_exists($user, 'hasRole') && $user->hasRole('rcic')
                    ? env('CONSULTANT_FRONTEND_URL', 'http://localhost:3003')
                    : env('PUBLIC_FRONTEND_URL', 'http://localhost:3000'),
                '/'
            );

            return $base.'/reset-password?'.http_build_query([
                'token' => $token,
                'email' => $user->getEmailForPasswordReset(),
            ]);
        };

        ResetPassword::createUrlUsing($resetUrl);

        VerifyEmail::toMailUsing(function (object $notifiable, string $url) {
            $branding = app(EmailBrandingService::class)->forPlatform(
                $notifiable->name ?? null
            );

            return (new MailMessage)
                ->subject('Verify Email Address')
                ->view('emails.auth.verify-email', array_merge($branding, [
                    'emailSubject' => 'Verify Email Address',
                    'actionUrl'    => $url,
                ]));
        });

        ResetPassword::toMailUsing(function (object $notifiable, string $token) use ($resetUrl) {
            $branding = app(EmailBrandingService::class)->forPlatform(
                $notifiable->name ?? null
            );
            $expire = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60);

            return (new MailMessage)
                ->subject('Reset Password Notification')
                ->view('emails.auth.reset-password', array_merge($branding, [
                    'emailSubject'  => 'Reset your password',
                    'actionUrl'     => $resetUrl($notifiable, $token),
                    'expireMinutes' => $expire,
                ]));
        });
    }
}

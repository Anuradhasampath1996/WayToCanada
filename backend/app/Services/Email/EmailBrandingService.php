<?php

namespace App\Services\Email;

use App\Models\User;
use App\Services\PlatformCompanySettingsService;

class EmailBrandingService
{
    public const PRIMARY_RED = '#D01D20';

    public const PRIMARY_RED_DARK = '#B0181B';

    public const INK = '#000103';

    public function __construct(
        private PlatformCompanySettingsService $company,
    ) {}

    /**
     * Platform branding for admin + consultant emails.
     *
     * @return array<string, mixed>
     */
    public function forPlatform(?string $recipientName = null): array
    {
        $settings = $this->company->get();
        $brandName = $settings->trade_name ?: $settings->legal_name ?: 'RCICMASTER';

        return [
            'mailLayout'       => 'emails.layouts.master',
            'layoutVariant'    => 'platform',
            'brandName'        => $brandName,
            'brandTagline'     => 'Immigration consultant workspace',
            'logoUrl'          => $this->absoluteUrl($settings->logo_url) ?: $this->defaultPlatformLogoUrl(),
            'primaryColor'     => self::PRIMARY_RED,
            'primaryDark'      => self::PRIMARY_RED_DARK,
            'inkColor'         => self::INK,
            'footerText'       => 'This is an automated message from '.$brandName.'. Please do not reply directly to this email.',
            'supportEmail'     => $settings->support_email ?: 'support@rcicmaster.com',
            'website'          => $settings->website ?: 'https://www.rcicmaster.com',
            'phone'            => $settings->phone,
            'companyAddress'   => $this->company->formattedAddressLines($settings),
            'recipientName'    => $recipientName,
            'poweredBy'        => null,
            'showPlatformLogo' => true,
        ];
    }

    /**
     * White-label branding for client-facing emails (consultant firm identity).
     *
     * @return array<string, mixed>
     */
    public function forConsultant(User $consultant, ?string $recipientName = null): array
    {
        $brandName = trim((string) ($consultant->company_name ?: $consultant->name)) ?: 'Your consultant';
        $address = array_values(array_filter([
            $consultant->company_address_line1,
            $consultant->company_address_line2,
            trim(implode(', ', array_filter([
                $consultant->company_city,
                $consultant->company_province,
                $consultant->company_postal_code,
            ]))),
            $consultant->company_country === 'CA' ? 'Canada' : $consultant->company_country,
        ]));

        return [
            'mailLayout'       => 'emails.layouts.client',
            'layoutVariant'    => 'client',
            'brandName'        => $brandName,
            'brandTagline'     => 'Immigration services',
            'logoUrl'          => $this->absoluteUrl($consultant->company_logo),
            'primaryColor'     => self::INK,
            'primaryDark'      => '#111827',
            'inkColor'         => self::INK,
            'footerText'       => 'This message was sent by '.$brandName.' via RCICMASTER.',
            'supportEmail'     => $consultant->email,
            'website'          => $consultant->company_website,
            'phone'            => $consultant->company_phone ?: null,
            'companyAddress'   => $address,
            'recipientName'    => $recipientName,
            'poweredBy'        => 'Powered by RCICMASTER',
            'poweredByUrl'     => 'https://www.rcicmaster.com',
            'showPlatformLogo' => false,
            'consultantName'   => $consultant->name,
        ];
    }

    /**
     * Pick platform vs client white-label from the recipient user.
     *
     * @return array<string, mixed>
     */
    public function forRecipient(User $user, ?string $recipientName = null): array
    {
        $name = $recipientName ?? $user->name;

        if ($this->isClientAudience($user)) {
            $consultant = $this->resolveConsultantForClient($user);
            if ($consultant) {
                return $this->forConsultant($consultant, $name);
            }
        }

        return $this->forPlatform($name);
    }

    /** @deprecated Use forPlatform() or forConsultant() */
    public function viewData(?string $recipientName = null): array
    {
        return $this->forPlatform($recipientName);
    }

    public function defaultPlatformLogoUrl(): string
    {
        return rtrim((string) config('app.url'), '/').'/brand/rcicmaster-logo.svg';
    }

    private function isClientAudience(User $user): bool
    {
        try {
            if (method_exists($user, 'hasRole') && $user->hasRole('client')) {
                return true;
            }
        } catch (\Throwable) {
            // roles table may be unavailable in some contexts
        }

        return $user->clientProfiles()->exists();
    }

    private function resolveConsultantForClient(User $user): ?User
    {
        $user->loadMissing('consultant');

        if ($user->consultant) {
            return $user->consultant;
        }

        $profile = $user->clientProfiles()->with('consultant')->latest('id')->first();

        return $profile?->consultant;
    }

    private function absoluteUrl(?string $url): ?string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return null;
        }

        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            return $url;
        }

        if (str_starts_with($url, '//')) {
            return 'https:'.$url;
        }

        return rtrim((string) config('app.url'), '/').'/'.ltrim($url, '/');
    }
}

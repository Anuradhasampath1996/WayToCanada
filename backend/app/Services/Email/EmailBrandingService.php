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
        $logo = $this->resolvePlatformLogo($settings->logo_url);

        return [
            'mailLayout'       => 'emails.layouts.master',
            'layoutVariant'    => 'platform',
            'brandName'        => $brandName,
            'brandTagline'     => 'Immigration consultant workspace',
            'logoUrl'          => $logo['url'],
            'logoDataUri'      => $logo['data_uri'],
            'logoEmbedPath'    => $logo['path'],
            'primaryColor'     => self::PRIMARY_RED,
            'primaryDark'      => self::PRIMARY_RED_DARK,
            'inkColor'         => self::INK,
            'footerText'       => 'This is an automated message from '.$brandName.'. Please do not reply directly to this email.',
            'supportEmail'     => $settings->support_email ?: 'support@rcicmaster.ca',
            'website'          => $settings->website ?: 'https://www.rcicmaster.ca',
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
        $logo = $this->resolveRemoteOrLocalLogo($consultant->company_logo);

        return [
            'mailLayout'       => 'emails.layouts.client',
            'layoutVariant'    => 'client',
            'brandName'        => $brandName,
            'brandTagline'     => 'Immigration services',
            'logoUrl'          => $logo['url'],
            'logoDataUri'      => $logo['data_uri'],
            'logoEmbedPath'    => $logo['path'],
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
            'poweredByUrl'     => 'https://www.rcicmaster.ca',
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
        return rtrim((string) config('app.url'), '/').'/brand/rcicmaster-logo.png';
    }

    public function defaultPlatformLogoPath(): string
    {
        return public_path('brand/rcicmaster-logo.png');
    }

    /**
     * @return array{url: ?string, data_uri: ?string, path: ?string}
     */
    private function resolvePlatformLogo(?string $configuredUrl): array
    {
        $path = $this->defaultPlatformLogoPath();
        $dataUri = is_file($path) ? $this->fileToDataUri($path) : null;

        // Prefer bundled PNG (email + preview safe). Only use configured logo when it looks usable.
        $configured = $this->absoluteUrl($configuredUrl);
        if ($configured && ! $this->looksLikeBrokenLocalhost($configured)) {
            return [
                'url'      => $configured,
                'data_uri' => $dataUri,
                'path'     => is_file($path) ? $path : null,
            ];
        }

        return [
            'url'      => $this->defaultPlatformLogoUrl(),
            'data_uri' => $dataUri,
            'path'     => is_file($path) ? $path : null,
        ];
    }

    /**
     * @return array{url: ?string, data_uri: ?string, path: ?string}
     */
    private function resolveRemoteOrLocalLogo(?string $url): array
    {
        $absolute = $this->absoluteUrl($url);
        $path = $this->localPathFromPublicUrl($absolute);
        $dataUri = ($path && is_file($path)) ? $this->fileToDataUri($path) : null;

        return [
            'url'      => $absolute,
            'data_uri' => $dataUri,
            'path'     => ($path && is_file($path)) ? $path : null,
        ];
    }

    private function fileToDataUri(string $path): ?string
    {
        $bytes = @file_get_contents($path);
        if ($bytes === false || $bytes === '') {
            return null;
        }

        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $mime = match ($ext) {
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'svg' => 'image/svg+xml',
            default => 'application/octet-stream',
        };

        return 'data:'.$mime.';base64,'.base64_encode($bytes);
    }

    private function localPathFromPublicUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH);
        if (! is_string($path) || $path === '') {
            return null;
        }

        // /storage/... → storage/app/public/...
        if (str_starts_with($path, '/storage/')) {
            $relative = substr($path, strlen('/storage/'));
            $candidate = storage_path('app/public/'.$relative);

            return is_file($candidate) ? $candidate : null;
        }

        // /brand/... → public/brand/...
        $publicCandidate = public_path(ltrim($path, '/'));

        return is_file($publicCandidate) ? $publicCandidate : null;
    }

    private function looksLikeBrokenLocalhost(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);

        return in_array($host, ['localhost', '127.0.0.1', '::1'], true)
            && ! app()->environment('local');
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

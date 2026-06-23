<?php

namespace App\Services\Email;

use App\Services\PlatformCompanySettingsService;

class EmailBrandingService
{
    public function __construct(
        private PlatformCompanySettingsService $company,
    ) {}

    /** @return array<string, mixed> */
    public function viewData(?string $recipientName = null): array
    {
        $settings = $this->company->get();

        return [
            'brandName'     => $settings->trade_name ?: $settings->legal_name ?: 'RCICMASTER',
            'brandTagline'  => 'Immigration consultant workspace',
            'footerText'    => 'This is an automated message from RCICMASTER. Please do not reply directly to this email.',
            'supportEmail'  => $settings->support_email,
            'website'       => $settings->website,
            'recipientName' => $recipientName,
        ];
    }
}

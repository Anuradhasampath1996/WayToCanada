<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Support\ClientAgreementDetails;
use App\Support\RetainerAgreementConfig;
use Barryvdh\DomPDF\Facade\Pdf;

class RetainerAgreementPdfService
{
    public function generate(CaseFile $caseFile): \Barryvdh\DomPDF\PDF
    {
        $caseFile->loadMissing('clientProfile.user', 'consultant');

        $config         = RetainerAgreementConfig::formatAgreementPayload($caseFile);
        $consultant     = $caseFile->consultant;
        $clientName     = $config['clientName'] ?: ($caseFile->clientProfile->user->name ?? '');
        $clientEmail    = $config['clientEmail'] ?: ($caseFile->clientProfile->user->email ?? '');
        $consultantName = $config['consultantName'] ?: ($consultant?->name ?? '');

        $totalFee = (float) $config['totalFee'];
        $m1       = (int) round($totalFee * (int) $config['milestone1Pct'] / 100);
        $m2       = (int) round($totalFee * (int) $config['milestone2Pct'] / 100);
        $m3       = (int) ($totalFee - $m1 - $m2);

        $currency = $config['currency'] ?? 'CAD';
        $fmt      = fn (int|float $n) => ($currency === 'USD' ? 'US$' : 'CA$') . number_format((float) $n, 0);

        $docDate = $caseFile->agreement_sent_at
            ? $caseFile->agreement_sent_at->format('F j, Y')
            : now()->format('F j, Y');

        $signedDate = $caseFile->agreement_signed_at
            ? $caseFile->agreement_signed_at->format('F j, Y')
            : null;

        $consultantProfile = $consultant ? [
            'name'                  => $consultant->name,
            'email'                 => $consultant->email,
            'phone'                 => $consultant->phone,
            'rcic_number'           => $consultant->rcic_number,
            'company_name'          => $consultant->company_name,
            'company_logo'          => $consultant->company_logo,
            'company_phone'         => $consultant->company_phone,
            'company_website'       => $consultant->company_website,
            'company_address_line1' => $consultant->company_address_line1,
            'company_address_line2' => $consultant->company_address_line2,
            'company_city'          => $consultant->company_city,
            'company_province'      => $consultant->company_province,
            'company_postal_code'   => $consultant->company_postal_code,
            'company_country'       => $consultant->company_country,
            'digital_signature'     => $consultant->digital_signature,
        ] : [];

        $companyName = $consultantProfile['company_name'] ?? $consultantName;
        $companyAddress = collect([
            $consultantProfile['company_address_line1'] ?? null,
            $consultantProfile['company_address_line2'] ?? null,
            $consultantProfile['company_city'] ?? null,
            $consultantProfile['company_province'] ?? null,
            $consultantProfile['company_postal_code'] ?? null,
            $consultantProfile['company_country'] ?? null,
        ])->filter()->implode(', ');

        $pathway = $config['pathway'] ?: ($caseFile->immigration_pathway ?? '');
        $scopeText = $config['scopeDescription'] ?? '';
        $clientDetails = ClientAgreementDetails::extract(
            $caseFile->clientProfile,
            is_array($config['clientDetails'] ?? null) ? $config['clientDetails'] : null,
        );

        return Pdf::loadView('pdf.retainer_agreement', [
            'config'            => $config,
            'clientName'        => $clientName,
            'clientEmail'       => $clientEmail,
            'clientDetails'     => $clientDetails,
            'consultantName'    => $consultantName,
            'consultantProfile' => $consultantProfile,
            'companyName'       => $companyName,
            'companyAddress'    => $companyAddress,
            'companyPhone'      => $consultantProfile['company_phone'] ?? $consultantProfile['phone'] ?? null,
            'companyWeb'        => $consultantProfile['company_website'] ?? null,
            'rcicNo'            => $consultantProfile['rcic_number'] ?? $config['consultantLicenseNo'] ?? null,
            'pathway'           => $pathway,
            'scopeText'         => $scopeText,
            'm1'                => $m1,
            'm2'                => $m2,
            'm3'                => $m3,
            'fmt'               => $fmt,
            'docDate'           => $docDate,
            'signedDate'        => $signedDate,
            'clientSignature'   => $caseFile->client_signature,
            'digitalSignature'  => $consultantProfile['digital_signature'] ?? null,
            'companyLogo'       => $consultantProfile['company_logo'] ?? null,
        ])
            ->setPaper('a4')
            ->setOption('isRemoteEnabled', true)
            ->setOption('isHtml5ParserEnabled', true);
    }

    public function filename(CaseFile $caseFile): string
    {
        $caseFile->loadMissing('clientProfile.user');
        $name = $caseFile->clientProfile->user->name ?? 'client';
        $slug = preg_replace('/[^a-zA-Z0-9_-]+/', '-', $name) ?: 'client';

        return 'retainer-agreement-' . trim($slug, '-') . '.pdf';
    }
}

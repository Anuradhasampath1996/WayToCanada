<?php

namespace App\Services;

use App\Models\SubscriptionPaymentRecord;
use App\Support\PdfImageEmbedder;
use Barryvdh\DomPDF\Facade\Pdf;

class SubscriptionInvoicePdfService
{
    public function __construct(
        private PlatformCompanySettingsService $companySettings,
        private GstHstRatesService $gstRates,
    ) {}

    public function generate(SubscriptionPaymentRecord $record): \Barryvdh\DomPDF\PDF
    {
        $record->loadMissing(
            'user:id,name,email,rcic_number,company_name,company_phone,company_address_line1,company_address_line2,company_city,company_province,company_postal_code,company_country',
            'package:id,name,description',
        );

        $company   = $this->companySettings->get();
        $billing   = $record->billing_address ?? [];
        $user      = $record->user;
        $invoiceNumber = $record->invoice_number ?? ('PAY-' . str_pad((string) $record->id, 6, '0', STR_PAD_LEFT));

        $billToLines = array_values(array_filter([
            $user?->name,
            $user?->company_name && $user->company_name !== $user->name ? $user->company_name : null,
            $user?->rcic_number ? 'RCIC ' . $user->rcic_number : null,
            $user?->email,
            $billing['line1'] ?? null,
            $billing['line2'] ?? null,
            trim(implode(', ', array_filter([
                $billing['city'] ?? null,
                $billing['province'] ?? $record->province,
                $billing['postal_code'] ?? null,
            ]))),
            $this->countryLabel($billing['country'] ?? $record->country),
        ]));

        $placeOfSupply = $record->province
            ? ($this->gstRates->getProvinceRate($record->province)['name'] ?? $record->province)
            : ($record->tax_applicable ? 'Canada' : 'Outside Canada');

        $paidAt = $record->paid_at?->timezone('America/Toronto');

        return Pdf::loadView('pdf.subscription_invoice', [
            'record'          => $record,
            'company'         => $company,
            'companyLogo'     => PdfImageEmbedder::logoDataUri($company->logo_url),
            'companyLines'    => $this->companySettings->formattedAddressLines($company),
            'invoiceNumber'   => $invoiceNumber,
            'billToLines'     => $billToLines,
            'packageName'     => trim($record->service_name ?? $record->package?->name ?? '') ?: 'RCICMASTER Platform Payment',
            'packageDesc'     => trim($record->package?->description ?? ''),
            'paidAt'          => $paidAt?->format('F j, Y') ?? '—',
            'paidAtIso'       => $paidAt?->format('Y-m-d') ?? '',
            'paymentType'     => ucfirst(str_replace('_', ' ', $record->payment_type ?? 'payment')),
            'billingCycle'    => $record->billing_cycle === 'yearly' ? 'Annual' : 'Monthly',
            'placeOfSupply'   => $placeOfSupply,
            'currency'        => strtoupper($record->currency ?? 'CAD'),
        ])->setPaper('letter', 'portrait');
    }

    public function filename(SubscriptionPaymentRecord $record): string
    {
        $invoiceNumber = $record->invoice_number ?? ('PAY-' . str_pad((string) $record->id, 6, '0', STR_PAD_LEFT));

        return 'invoice-' . preg_replace('/[^A-Za-z0-9\-]/', '-', $invoiceNumber) . '.pdf';
    }

    private function countryLabel(?string $code): ?string
    {
        if (! $code) {
            return null;
        }

        return match (strtoupper($code)) {
            'CA'    => 'Canada',
            'US'    => 'United States',
            default => strtoupper($code),
        };
    }
}

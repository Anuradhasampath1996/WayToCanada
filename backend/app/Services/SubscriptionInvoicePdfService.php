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
        private SubscriptionPaymentRecorder $recorder,
    ) {}

    public function generate(SubscriptionPaymentRecord $record): \Barryvdh\DomPDF\PDF
    {
        $record->loadMissing(
            'user:id,name,email,rcic_number,company_name,company_phone,company_address_line1,company_address_line2,company_city,company_province,company_postal_code,company_country',
            'package:id,name,description,features,monthly_price,yearly_price,free_trial_days',
            'subscription:id,billing_cycle,status,starts_at,ends_at,trial_ends_at,last_payment_at',
        );

        $this->recorder->repairInconsistentTax($record);

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
        $companyLogo = PdfImageEmbedder::logoDataUri($company->logo_url)
            ?? PdfImageEmbedder::logoDataUri(public_path('brand/rcicmaster-logo.png'));

        $coverage = $this->coveragePeriod($record);
        $packageFeatures = $this->packageFeatureLines($record->package?->features);
        $listPrice = $record->billing_cycle === 'yearly'
            ? $record->package?->yearly_price
            : $record->package?->monthly_price;

        return Pdf::loadView('pdf.subscription_invoice', [
            'record'           => $record,
            'company'          => $company,
            'companyLogo'      => $companyLogo,
            'companyLines'     => $this->companySettings->formattedAddressLines($company),
            'invoiceNumber'    => $invoiceNumber,
            'billToLines'      => $billToLines,
            'packageName'      => trim($record->service_name ?? $record->package?->name ?? '') ?: 'RCICMASTER Platform Payment',
            'packageDesc'      => trim($record->package?->description ?? ''),
            'packageFeatures'  => $packageFeatures,
            'listPrice'        => $listPrice !== null ? (float) $listPrice : null,
            'paidAt'           => $paidAt?->format('F j, Y') ?? '—',
            'paidAtIso'        => $paidAt?->format('Y-m-d') ?? '',
            'paymentType'      => ucfirst(str_replace('_', ' ', $record->payment_type ?? 'payment')),
            'billingCycle'     => $record->billing_cycle === 'yearly' ? 'Annual' : 'Monthly',
            'periodStart'      => $coverage['start'],
            'periodEnd'        => $coverage['end'],
            'periodLabel'      => $coverage['label'],
            'subscriptionStatus'=> $record->subscription?->status,
            'placeOfSupply'    => $placeOfSupply,
            'currency'         => strtoupper($record->currency ?? 'CAD'),
            'brandPrimary'     => '#D01D20',
            'brandPrimaryDark' => '#B0181B',
            'brandInk'         => '#000103',
        ])->setPaper('letter', 'portrait');
    }

    public function filename(SubscriptionPaymentRecord $record): string
    {
        $invoiceNumber = $record->invoice_number ?? ('PAY-' . str_pad((string) $record->id, 6, '0', STR_PAD_LEFT));

        return 'invoice-' . preg_replace('/[^A-Za-z0-9\-]/', '-', $invoiceNumber) . '.pdf';
    }

    /**
     * @return array{start: ?string, end: ?string, label: ?string}
     */
    private function coveragePeriod(SubscriptionPaymentRecord $record): array
    {
        $tz = 'America/Toronto';
        $sub = $record->subscription;
        $paidAt = $record->paid_at?->copy()->timezone($tz);

        $start = $sub?->starts_at?->copy()->timezone($tz) ?? $paidAt;
        $end = $sub?->ends_at?->copy()->timezone($tz);

        if (! $end && $paidAt) {
            $end = $record->billing_cycle === 'yearly'
                ? $paidAt->copy()->addYear()
                : $paidAt->copy()->addMonth();
        }

        if (! $start && ! $end) {
            return ['start' => null, 'end' => null, 'label' => null];
        }

        $startFmt = $start?->format('M j, Y');
        $endFmt = $end?->format('M j, Y');

        $label = match (true) {
            $startFmt && $endFmt => "{$startFmt} – {$endFmt}",
            (bool) $endFmt       => "Expires {$endFmt}",
            (bool) $startFmt     => "Starts {$startFmt}",
            default              => null,
        };

        return [
            'start' => $startFmt,
            'end'   => $endFmt,
            'label' => $label,
        ];
    }

    /**
     * @param  mixed  $features
     * @return list<string>
     */
    private function packageFeatureLines(mixed $features): array
    {
        if (! is_array($features) || $features === []) {
            return [];
        }

        $lines = [];
        foreach ($features as $feature) {
            if (is_string($feature) && trim($feature) !== '') {
                $lines[] = trim($feature);
            } elseif (is_array($feature)) {
                $text = trim((string) ($feature['label'] ?? $feature['name'] ?? $feature['text'] ?? ''));
                if ($text !== '') {
                    $lines[] = $text;
                }
            }

            if (count($lines) >= 6) {
                break;
            }
        }

        return $lines;
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

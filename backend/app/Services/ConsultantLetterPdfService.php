<?php

namespace App\Services;

use App\Models\ConsultantLetter;
use App\Support\PdfImageEmbedder;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Str;

class ConsultantLetterPdfService
{
    public function generate(ConsultantLetter $letter): \Barryvdh\DomPDF\PDF
    {
        $letter->loadMissing('consultant', 'clientProfile.user');
        $consultant = $letter->consultant;
        $client     = $letter->clientProfile?->user;
        $snapshot   = is_array($letter->context_snapshot) ? $letter->context_snapshot : [];
        $clientSnap = $snapshot['client'] ?? [];

        $companyName = $consultant?->company_name ?? $consultant?->name ?? '';
        $companyAddress = $this->formatAddress($consultant);

        return Pdf::loadView('pdf.consultant_letter', [
            'title'            => $letter->title,
            'subject'          => $letter->subject,
            'bodyHtml'         => $this->stripEmbeddedSignature($letter->body_html ?? ''),
            'consultantName'   => $consultant?->name ?? '',
            'consultantEmail'  => $consultant?->email,
            'rcicNumber'       => $consultant?->rcic_number,
            'companyName'      => $companyName,
            'companyAddress'   => $companyAddress,
            'companyPhone'     => $consultant?->company_phone ?? $consultant?->phone,
            'companyWebsite'   => $consultant?->company_website,
            'companyLogo'      => PdfImageEmbedder::logoDataUri($consultant?->company_logo),
            'digitalSignature' => PdfImageEmbedder::logoDataUri($consultant?->digital_signature),
            'clientName'       => $clientSnap['client_name'] ?? $client?->name,
            'clientEmail'      => $clientSnap['client_email'] ?? $client?->email,
            'clientPhone'      => $clientSnap['client_phone'] ?? $letter->clientProfile?->phone ?? $client?->phone,
            'clientPathway'    => $clientSnap['immigration_pathway'] ?? $letter->clientProfile?->immigration_pathway,
            'applicationRef'   => $clientSnap['passport_number'] ?? $letter->clientProfile?->passport_number,
            'letterDate'       => now()->format('F j, Y'),
            'generatedDate'    => now()->format('F j, Y'),
        ])->setPaper('letter');
    }

    public function filename(ConsultantLetter $letter): string
    {
        $slug = Str::slug($letter->title ?: 'letter');

        return "{$slug}-{$letter->id}.pdf";
    }

    /** @return array<string, mixed> */
    public function brandingForConsultant(?\App\Models\User $consultant): array
    {
        if (! $consultant) {
            return [];
        }

        return [
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
            'company_country'       => $consultant->company_country ?? 'Canada',
            'digital_signature'     => $consultant->digital_signature,
            'formatted_address'     => $this->formatAddress($consultant),
        ];
    }

    private function formatAddress(?\App\Models\User $consultant): string
    {
        if (! $consultant) {
            return '';
        }

        return collect([
            $consultant->company_address_line1,
            $consultant->company_address_line2,
            collect([
                $consultant->company_city,
                $consultant->company_province,
                $consultant->company_postal_code,
            ])->filter()->implode(', '),
            $consultant->company_country ?? 'Canada',
        ])->filter()->implode(', ');
    }

    /** Remove duplicate consultant signature blocks AI may have added to body. */
    private function stripEmbeddedSignature(string $html): string
    {
        if ($html === '') {
            return $html;
        }

        // Trim trailing signature blocks after "Sincerely" / "Yours faithfully"
        $patterns = [
            '/(<p>\s*(?:Sincerely|Yours faithfully|Yours truly|Respectfully),?\s*<\/p>)(.*)$/is',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $html, $matches)) {
                $tail = $matches[2] ?? '';
                if ($tail !== '' && preg_match('/RCIC|Regulated Canadian|License No|@\w+\.\w+/i', $tail)) {
                    $html = $matches[1];
                }
            }
        }

        return trim($html);
    }
}

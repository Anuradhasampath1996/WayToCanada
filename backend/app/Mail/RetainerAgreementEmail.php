<?php

namespace App\Mail;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\User;
use App\Services\Email\EmailBrandingService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RetainerAgreementEmail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly ClientProfile $clientProfile,
        public readonly CaseFile      $caseFile,
        public readonly User          $consultant,
    ) {}

    public function envelope(): Envelope
    {
        $firm = $this->consultant->company_name ?: $this->consultant->name;

        return new Envelope(
            subject: 'Your Retainer Agreement — '.$firm,
        );
    }

    public function content(): Content
    {
        $publicDashboardUrl = rtrim((string) env('PUBLIC_DASHBOARD_URL', 'http://localhost:3002'), '/');
        $url = $publicDashboardUrl.'/agreement/'.$this->caseFile->agreement_token;
        $branding = app(EmailBrandingService::class)->forConsultant(
            $this->consultant,
            $this->clientProfile->user->name,
        );

        return new Content(
            view: 'emails.retainer_agreement',
            with: array_merge($branding, [
                'emailSubject'   => 'Your Retainer Agreement',
                'clientName'     => $this->clientProfile->user->name,
                'consultantName' => $this->consultant->name,
                'pathway'        => $this->caseFile->immigration_pathway,
                'agreementUrl'   => $url,
            ]),
        );
    }
}

<?php

namespace App\Mail;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\User;
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
        return new Envelope(
            subject: 'Your Retainer Agreement — Way To Canada',
        );
    }

    public function content(): Content
    {
        $publicDashboardUrl = rtrim(env('PUBLIC_DASHBOARD_URL', 'http://localhost:3003'), '/');
        $url = $publicDashboardUrl . '/agreement/' . $this->caseFile->agreement_token;

        return new Content(
            view: 'emails.retainer_agreement',
            with: [
                'clientName'      => $this->clientProfile->user->name,
                'consultantName'  => $this->consultant->name,
                'pathway'         => $this->caseFile->immigration_pathway,
                'agreementUrl'    => $url,
            ],
        );
    }
}

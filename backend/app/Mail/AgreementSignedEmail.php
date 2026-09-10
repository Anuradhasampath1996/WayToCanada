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

class AgreementSignedEmail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly ClientProfile $clientProfile,
        public readonly CaseFile      $caseFile,
        public readonly User          $consultant,
        public readonly string        $signedVia = 'digital_signature',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Client Signed Retainer Agreement — '.($this->clientProfile->user->name ?? 'Client'),
        );
    }

    public function content(): Content
    {
        $consultantDashboardUrl = rtrim((string) env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3001'), '/');
        $workspaceUrl = $consultantDashboardUrl.'/dashboard/clients/'.$this->clientProfile->id.'/workspace';
        $branding = app(EmailBrandingService::class)->forPlatform($this->consultant->name);

        return new Content(
            view: 'emails.agreement_signed',
            with: array_merge($branding, [
                'emailSubject'   => 'Client Signed Retainer Agreement',
                'clientName'     => $this->clientProfile->user->name,
                'consultantName' => $this->consultant->name,
                'pathway'        => $this->caseFile->immigration_pathway,
                'signedAt'       => $this->caseFile->agreement_signed_at?->format('F j, Y g:i A'),
                'signedVia'      => $this->signedVia,
                'workspaceUrl'   => $workspaceUrl,
            ]),
        );
    }
}

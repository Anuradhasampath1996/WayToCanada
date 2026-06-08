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

class AgreementReminderEmail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public ClientProfile $profile,
        public CaseFile $caseFile,
        public User $consultant,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reminder: Please sign your retainer agreement',
        );
    }

    public function content(): Content
    {
        $publicDashboardUrl = rtrim((string) env('PUBLIC_DASHBOARD_URL', 'http://localhost:3003'), '/');
        $url = $publicDashboardUrl . '/agreement/' . $this->caseFile->agreement_token;

        return new Content(
            view: 'emails.agreement_reminder',
            with: [
                'clientName'     => $this->profile->user->name ?? 'Client',
                'consultantName' => $this->consultant->name,
                'agreementUrl'   => $url,
                'sentAt'         => $this->caseFile->agreement_sent_at?->format('F j, Y'),
            ],
        );
    }
}

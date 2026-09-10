<?php

namespace App\Mail;

use App\Models\ClientPaymentRequest;
use App\Models\ClientProfile;
use App\Models\User;
use App\Services\Email\EmailBrandingService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ClientPaymentRequestEmail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly ClientProfile $clientProfile,
        public readonly ClientPaymentRequest $paymentRequest,
        public readonly User $consultant,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Payment request from '.($this->consultant->company_name ?: $this->consultant->name),
        );
    }

    public function content(): Content
    {
        $branding = app(EmailBrandingService::class)->forConsultant(
            $this->consultant,
            $this->clientProfile->user->name,
        );

        return new Content(
            view: 'emails.client_payment_request',
            with: array_merge($branding, [
                'emailSubject'   => 'Payment request',
                'clientName'     => $this->clientProfile->user->name,
                'consultantName' => $this->consultant->name,
                'companyName'    => $this->consultant->company_name,
                'title'          => $this->paymentRequest->title,
                'amount'         => number_format((float) $this->paymentRequest->amount, 2),
                'currency'       => $this->paymentRequest->currency,
                'description'    => $this->paymentRequest->description,
                'payUrl'         => $this->paymentRequest->publicUrl(),
            ]),
        );
    }
}

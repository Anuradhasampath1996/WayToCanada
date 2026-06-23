<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use App\Services\Notifications\WhatsAppMessageBuilder;
use App\Services\WhatsApp\WhatsAppDeliveryService;
use App\Support\WhatsAppStructuredMessage;

class AgreementReminderService
{
    public function __construct(
        private WhatsAppMessageBuilder $whatsappMessages,
        private WhatsAppDeliveryService $whatsappDelivery,
    ) {}

    public function resolveClientPhone(ClientProfile $profile): ?string
    {
        $profile->loadMissing('user');

        $phone = $profile->phone ?: $profile->user?->phone;

        if ($phone) {
            return $phone;
        }

        $submission = QuestionnaireSubmission::where('client_profile_id', $profile->id)
            ->latest('id')
            ->first();

        $whatsapp = $submission?->main_data['whatsapp'] ?? $submission?->step1_data['whatsapp'] ?? null;

        return is_string($whatsapp) && trim($whatsapp) !== '' ? trim($whatsapp) : null;
    }

    public function buildSigningUrl(CaseFile $caseFile): string
    {
        $publicDashboardUrl = rtrim((string) env('PUBLIC_DASHBOARD_URL', 'http://localhost:3003'), '/');

        return $publicDashboardUrl . '/agreement/' . $caseFile->agreement_token;
    }

    public function buildReminderMessage(CaseFile $caseFile, string $clientName, User $consultant): string
    {
        return $this->buildReminderStructured($caseFile, $clientName, $consultant)->toPlainText();
    }

    public function buildReminderStructured(CaseFile $caseFile, string $clientName, User $consultant): WhatsAppStructuredMessage
    {
        return $this->whatsappMessages->buildStructuredForClient(
            $clientName,
            $consultant,
            'Retainer agreement ready to sign',
            'Your retainer agreement is ready for signature. Please review and sign when you have a moment.',
            $this->buildSigningUrl($caseFile),
        );
    }

    public function toWhatsAppUrl(string $phone, string $message): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';
        if (strlen($digits) === 10) {
            $digits = '1' . $digits;
        }

        return 'https://wa.me/' . $digits . '?text=' . rawurlencode($message);
    }

    /** @return array{sent: bool, error: string|null, provider: string|null} */
    public function sendWhatsApp(string $phone, WhatsAppStructuredMessage $message): array
    {
        return $this->whatsappDelivery->send($phone, $message);
    }

    /** @return array{sent: bool, error: string|null} */
    public function sendViaTwilio(string $phone, string $message): array
    {
        $result = $this->whatsappDelivery->send($phone, new WhatsAppStructuredMessage(
            WhatsAppStructuredMessage::AUDIENCE_CLIENT,
            'there',
            'Notification',
            $message,
        ));

        return [
            'sent'  => $result['sent'],
            'error' => $result['error'],
        ];
    }
}

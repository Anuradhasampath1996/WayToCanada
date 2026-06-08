<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AgreementReminderService
{
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

    public function buildReminderMessage(CaseFile $caseFile, string $clientName, string $consultantName): string
    {
        $url = $this->buildSigningUrl($caseFile);

        return "Hi {$clientName}, this is {$consultantName} from WayToCanada. "
            . "Your retainer agreement is ready for signature. Please review and sign here: {$url} "
            . "Thank you!";
    }

    public function toWhatsAppUrl(string $phone, string $message): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';
        if (strlen($digits) === 10) {
            $digits = '1' . $digits;
        }

        return 'https://wa.me/' . $digits . '?text=' . rawurlencode($message);
    }

    /** @return array{sent: bool, error: string|null} */
    public function sendViaTwilio(string $phone, string $message): array
    {
        $sid   = config('services.twilio.sid');
        $token = config('services.twilio.token');
        $from  = config('services.twilio.whatsapp_from');

        if (! $sid || ! $token || ! $from) {
            return ['sent' => false, 'error' => null];
        }

        $digits = preg_replace('/\D/', '', $phone) ?? '';
        if (strlen($digits) === 10) {
            $digits = '1' . $digits;
        }

        try {
            $response = Http::withBasicAuth($sid, $token)
                ->asForm()
                ->post('https://api.twilio.com/2010-04-01/Accounts/' . $sid . '/Messages.json', [
                    'From' => str_starts_with($from, 'whatsapp:') ? $from : 'whatsapp:' . $from,
                    'To'   => 'whatsapp:+' . $digits,
                    'Body' => $message,
                ]);

            if ($response->successful()) {
                return ['sent' => true, 'error' => null];
            }

            Log::warning('Twilio WhatsApp reminder failed', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);

            return ['sent' => false, 'error' => 'Twilio API error.'];
        } catch (\Throwable $e) {
            Log::warning('Twilio WhatsApp reminder exception', ['message' => $e->getMessage()]);

            return ['sent' => false, 'error' => $e->getMessage()];
        }
    }
}

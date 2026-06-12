<?php

namespace App\Services\Meetings;

use App\Models\ConsultantMeetingAccount;
use Carbon\Carbon;

class MeetingSchedulerService
{
    public function __construct(
        private GoogleMeetIntegrationService $google,
        private ZoomMeetingIntegrationService $zoom,
        private TeamsMeetingIntegrationService $teams,
    ) {}

    public function isReadyFor(ConsultantMeetingAccount $account, string $provider): bool
    {
        return match ($provider) {
            'google_meet' => $this->google->isConnected($account) || $this->hasManualUrl($account, $provider),
            'zoom'        => $this->zoom->isConnected($account) || $this->hasManualUrl($account, $provider),
            'teams'       => $this->teams->isConnected($account) || $this->hasManualUrl($account, $provider),
            default       => false,
        };
    }

    public function isOAuthConnected(ConsultantMeetingAccount $account, string $provider): bool
    {
        return match ($provider) {
            'google_meet' => $this->google->isConnected($account),
            'zoom'        => $this->zoom->isConnected($account),
            'teams'       => $this->teams->isConnected($account),
            default       => false,
        };
    }

    /**
     * @return array{meeting_url: string, external_id: string|null, calendar_event_id: string|null, scheduled_via: string}
     */
    public function schedule(
        ConsultantMeetingAccount $account,
        string $provider,
        string $title,
        ?string $description,
        Carbon $startUtc,
        int $durationMinutes,
        string $timezone,
        ?string $manualUrl = null,
    ): array {
        $startLocal = $startUtc->copy()->timezone($timezone);

        if ($this->isOAuthConnected($account, $provider)) {
            $result = match ($provider) {
                'google_meet' => $this->google->createMeeting($account, $title, $description, $startLocal, $durationMinutes, $timezone),
                'zoom'        => $this->zoom->createMeeting($account, $title, $description, $startLocal, $durationMinutes, $timezone),
                'teams'       => $this->teams->createMeeting($account, $title, $description, $startLocal, $durationMinutes, $timezone),
                default       => throw new \RuntimeException('Unsupported meeting provider.'),
            };

            $result['scheduled_via'] = 'oauth';

            return $result;
        }

        $url = $manualUrl ?? $account->meetingUrlFor($provider);
        if (! $url || ! filter_var($url, FILTER_VALIDATE_URL)) {
            throw new \RuntimeException("Connect your {$provider} account in Account → Video meetings to schedule automatically.");
        }

        return [
            'meeting_url'       => $url,
            'external_id'       => null,
            'calendar_event_id' => null,
            'scheduled_via'     => 'manual_link',
        ];
    }

    private function hasManualUrl(ConsultantMeetingAccount $account, string $provider): bool
    {
        $url = $account->meetingUrlFor($provider);

        return $url && filter_var($url, FILTER_VALIDATE_URL);
    }
}

<?php

namespace App\Services\Meetings;

use App\Models\ConsultantMeetingAccount;
use App\Support\MeetingOAuthTokens;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class GoogleMeetIntegrationService
{
    public function isConfigured(): bool
    {
        return (bool) (config('services.google_meet.client_id') && config('services.google_meet.client_secret'));
    }

    public function authorizeUrl(string $state): string
    {
        $params = http_build_query([
            'client_id'     => config('services.google_meet.client_id'),
            'redirect_uri'  => config('services.google_meet.redirect_uri'),
            'response_type' => 'code',
            'scope'         => 'https://www.googleapis.com/auth/calendar.events email profile',
            'access_type'   => 'offline',
            'prompt'        => 'consent',
            'state'         => $state,
        ]);

        return 'https://accounts.google.com/o/oauth2/v2/auth?' . $params;
    }

    public function handleCallback(string $code): array
    {
        $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'code'          => $code,
            'client_id'     => config('services.google_meet.client_id'),
            'client_secret' => config('services.google_meet.client_secret'),
            'redirect_uri'  => config('services.google_meet.redirect_uri'),
            'grant_type'    => 'authorization_code',
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Google authorization failed: ' . ($response->json('error_description') ?? 'unknown error'));
        }

        $data = $response->json();
        $email = $this->fetchEmail($data['access_token']);

        return [
            'email'         => $email,
            'access_token'  => $data['access_token'],
            'refresh_token' => $data['refresh_token'] ?? null,
            'expires_at'    => now()->addSeconds((int) ($data['expires_in'] ?? 3600)),
        ];
    }

    public function storeTokens(ConsultantMeetingAccount $account, array $tokens): void
    {
        $account->update([
            'google_account_email'    => $tokens['email'],
            'google_access_token'     => MeetingOAuthTokens::encrypt($tokens['access_token']),
            'google_refresh_token'    => MeetingOAuthTokens::encrypt($tokens['refresh_token'] ?? MeetingOAuthTokens::decrypt($account->google_refresh_token)),
            'google_token_expires_at' => $tokens['expires_at'],
            'google_connected_at'     => now(),
        ]);
    }

    public function disconnect(ConsultantMeetingAccount $account): void
    {
        $account->update([
            'google_account_email'    => null,
            'google_access_token'     => null,
            'google_refresh_token'    => null,
            'google_token_expires_at' => null,
            'google_connected_at'     => null,
            'google_meet_url'         => null,
        ]);
    }

    public function isConnected(ConsultantMeetingAccount $account): bool
    {
        return (bool) ($account->google_connected_at && ($account->google_refresh_token || $account->google_access_token));
    }

    /**
     * @return array{meeting_url: string, external_id: string|null, calendar_event_id: string|null}
     */
    public function createMeeting(
        ConsultantMeetingAccount $account,
        string $title,
        ?string $description,
        Carbon $start,
        int $durationMinutes,
        string $timezone,
    ): array {
        $token = $this->accessToken($account);
        $end   = $start->copy()->timezone($timezone)->addMinutes($durationMinutes);

        $payload = [
            'summary'     => $title,
            'description' => $description,
            'start'       => [
                'dateTime' => $start->timezone($timezone)->format('Y-m-d\TH:i:s'),
                'timeZone' => $timezone,
            ],
            'end' => [
                'dateTime' => $end->format('Y-m-d\TH:i:s'),
                'timeZone' => $timezone,
            ],
            'conferenceData' => [
                'createRequest' => [
                    'requestId'             => Str::uuid()->toString(),
                    'conferenceSolutionKey' => ['type' => 'hangoutsMeet'],
                ],
            ],
        ];

        $response = Http::withToken($token)
            ->post('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', $payload);

        if (! $response->successful()) {
            throw new \RuntimeException('Could not create Google Meet: ' . ($response->json('error.message') ?? $response->body()));
        }

        $event = $response->json();
        $meetUrl = $event['hangoutLink']
            ?? ($event['conferenceData']['entryPoints'][0]['uri'] ?? null);

        if (! $meetUrl) {
            throw new \RuntimeException('Google Meet link was not returned. Ensure Google Calendar API is enabled.');
        }

        return [
            'meeting_url'       => $meetUrl,
            'external_id'       => $event['id'] ?? null,
            'calendar_event_id' => $event['id'] ?? null,
        ];
    }

    private function accessToken(ConsultantMeetingAccount $account): string
    {
        if ($account->google_token_expires_at && $account->google_token_expires_at->isFuture()) {
            $existing = MeetingOAuthTokens::decrypt($account->google_access_token);
            if ($existing) {
                return $existing;
            }
        }

        $refresh = MeetingOAuthTokens::decrypt($account->google_refresh_token);
        if (! $refresh) {
            throw new \RuntimeException('Google account disconnected. Please reconnect in Account settings.');
        }

        $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'client_id'     => config('services.google_meet.client_id'),
            'client_secret' => config('services.google_meet.client_secret'),
            'refresh_token' => $refresh,
            'grant_type'    => 'refresh_token',
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Google session expired. Please reconnect your Google account.');
        }

        $data = $response->json();
        $account->update([
            'google_access_token'     => MeetingOAuthTokens::encrypt($data['access_token']),
            'google_token_expires_at' => now()->addSeconds((int) ($data['expires_in'] ?? 3600)),
        ]);

        return $data['access_token'];
    }

    /**
     * @return list<array{start: string, end: string}>
     */
    public function fetchBusyPeriods(
        ConsultantMeetingAccount $account,
        Carbon $from,
        Carbon $to,
        string $timezone,
    ): array {
        $token = $this->accessToken($account);

        $response = Http::withToken($token)->post('https://www.googleapis.com/calendar/v3/freeBusy', [
            'timeMin'  => $from->copy()->utc()->toRfc3339String(),
            'timeMax'  => $to->copy()->utc()->toRfc3339String(),
            'timeZone' => $timezone,
            'items'    => [['id' => 'primary']],
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Could not load Google Calendar availability.');
        }

        $busy = $response->json('calendars.primary.busy') ?? [];
        $periods = [];

        foreach ($busy as $block) {
            if (empty($block['start']) || empty($block['end'])) {
                continue;
            }

            $periods[] = [
                'start' => Carbon::parse($block['start'])->timezone($timezone)->toIso8601String(),
                'end'   => Carbon::parse($block['end'])->timezone($timezone)->toIso8601String(),
            ];
        }

        return $periods;
    }

    /**
     * @return list<array{id: string, title: string, start: string, end: string, all_day: bool, meeting_url: string|null}>
     */
    public function fetchCalendarEvents(
        ConsultantMeetingAccount $account,
        Carbon $from,
        Carbon $to,
        string $timezone,
    ): array {
        $token = $this->accessToken($account);

        $response = Http::withToken($token)->get('https://www.googleapis.com/calendar/v3/calendars/primary/events', [
            'timeMin'      => $from->copy()->utc()->toRfc3339String(),
            'timeMax'      => $to->copy()->utc()->toRfc3339String(),
            'singleEvents' => 'true',
            'orderBy'      => 'startTime',
            'maxResults'   => 250,
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Could not load Google Calendar events.');
        }

        $items  = $response->json('items') ?? [];
        $events = [];

        foreach ($items as $item) {
            $startRaw = $item['start']['dateTime'] ?? $item['start']['date'] ?? null;
            $endRaw   = $item['end']['dateTime'] ?? $item['end']['date'] ?? null;

            if (! $startRaw || ! $endRaw) {
                continue;
            }

            $allDay = isset($item['start']['date']);
            $start  = $allDay
                ? Carbon::parse($startRaw, $timezone)->startOfDay()
                : Carbon::parse($startRaw)->timezone($timezone);
            $end = $allDay
                ? Carbon::parse($endRaw, $timezone)->startOfDay()
                : Carbon::parse($endRaw)->timezone($timezone);

            $meetUrl = $item['hangoutLink']
                ?? ($item['conferenceData']['entryPoints'][0]['uri'] ?? null);

            $events[] = [
                'id'          => (string) ($item['id'] ?? ''),
                'title'       => (string) ($item['summary'] ?? 'Busy'),
                'start'       => $start->toIso8601String(),
                'end'         => $end->toIso8601String(),
                'all_day'     => $allDay,
                'meeting_url' => $meetUrl,
            ];
        }

        return $events;
    }

    private function fetchEmail(string $accessToken): ?string
    {
        $response = Http::withToken($accessToken)->get('https://www.googleapis.com/oauth2/v2/userinfo');

        return $response->successful() ? ($response->json('email') ?? null) : null;
    }
}

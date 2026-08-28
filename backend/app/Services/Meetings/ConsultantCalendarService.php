<?php

namespace App\Services\Meetings;

use App\Models\ClientMeeting;
use App\Models\ConsultantMeetingAccount;
use App\Models\User;
use Carbon\Carbon;

class ConsultantCalendarService
{
    public function __construct(
        private GoogleMeetIntegrationService $google,
    ) {}

    /**
     * @return array{
     *   timezone: string,
     *   google_connected: bool,
     *   events: list<array{
     *     id: string,
     *     title: string,
     *     start: string,
     *     end: string,
     *     all_day: bool,
     *     source: string,
     *     client_profile_id: int|null,
     *     client_name: string|null,
     *     client_avatar: string|null,
     *     description: string|null,
     *     duration_minutes: int|null,
     *     meeting_url: string|null,
     *     provider: string|null
     *   }>
     * }
     */
    public function getEvents(User $consultant, Carbon $from, Carbon $to, string $timezone): array
    {
        $account = ConsultantMeetingAccount::where('user_id', $consultant->id)->first();
        $events  = [];

        $meetings = ClientMeeting::with(['clientProfile.user'])
            ->where('consultant_id', $consultant->id)
            ->where('status', 'scheduled')
            ->where('scheduled_at', '>=', $from->copy()->utc()->subDay())
            ->where('scheduled_at', '<=', $to->copy()->utc()->addDay())
            ->orderBy('scheduled_at')
            ->get();

        $linkedGoogleIds = [];

        foreach ($meetings as $meeting) {
            $start = $meeting->scheduled_at->copy()->timezone($timezone);
            $end   = $start->copy()->addMinutes($meeting->duration_minutes);

            if (! $start->lt($to) || ! $end->gt($from)) {
                continue;
            }

            $clientUser = $meeting->clientProfile?->user;
            $clientName = $clientUser?->name ?? 'Client';
            $clientAvatar = filled($clientUser?->avatar) ? (string) $clientUser->avatar : null;

            if ($meeting->calendar_event_id) {
                $linkedGoogleIds[] = $meeting->calendar_event_id;
            }

            $rawDesc = trim((string) ($meeting->description ?? ''));
            $rawDesc = preg_replace('/\s*\[demo-july-2026\]\s*/i', '', $rawDesc) ?? $rawDesc;

            $events[] = [
                'id'                => 'meeting-' . $meeting->id,
                'title'             => $meeting->title . ' · ' . $clientName,
                'start'             => $start->toIso8601String(),
                'end'               => $end->toIso8601String(),
                'all_day'           => false,
                'source'            => 'client_meeting',
                'client_profile_id' => $meeting->client_profile_id,
                'client_name'       => $clientName,
                'client_avatar'     => $clientAvatar,
                'description'       => $rawDesc !== '' ? $rawDesc : null,
                'duration_minutes'  => (int) $meeting->duration_minutes,
                'meeting_url'       => $meeting->meeting_url,
                'provider'          => $meeting->provider,
            ];
        }

        $googleConnected = $account && $this->google->isConnected($account);

        if ($googleConnected) {
            try {
                foreach ($this->google->fetchCalendarEvents($account, $from, $to, $timezone) as $event) {
                    if (in_array($event['id'], $linkedGoogleIds, true)) {
                        continue;
                    }

                    $events[] = [
                        'id'                => 'google-' . $event['id'],
                        'title'             => $event['title'],
                        'start'             => $event['start'],
                        'end'               => $event['end'],
                        'all_day'           => $event['all_day'],
                        'source'            => 'google_calendar',
                        'client_profile_id' => null,
                        'client_name'       => null,
                        'client_avatar'     => null,
                        'description'       => $event['description'] ?? null,
                        'duration_minutes'  => null,
                        'meeting_url'       => $event['meeting_url'],
                        'provider'          => null,
                    ];
                }
            } catch (\Throwable) {
                // Return client meetings even if Google sync fails.
            }
        }

        usort($events, fn (array $a, array $b) => strcmp($a['start'], $b['start']));

        return [
            'timezone'         => $timezone,
            'google_connected' => (bool) $googleConnected,
            'events'           => $events,
        ];
    }
}

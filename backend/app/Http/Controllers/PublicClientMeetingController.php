<?php

namespace App\Http\Controllers;

use App\Models\ClientMeeting;
use Illuminate\Http\JsonResponse;

class PublicClientMeetingController extends Controller
{
    public function show(string $token): JsonResponse
    {
        $meeting = ClientMeeting::with(['consultant', 'clientProfile.user'])
            ->where('token', $token)
            ->firstOrFail();

        $local = $meeting->scheduled_at->timezone($meeting->timezone);

        return response()->json([
            'title'            => $meeting->title,
            'description'      => $meeting->description,
            'scheduled_at'     => $local->toIso8601String(),
            'scheduled_display'=> $local->format('l, F j, Y \a\t g:i A T'),
            'duration_minutes' => $meeting->duration_minutes,
            'timezone'         => $meeting->timezone,
            'provider'         => $meeting->provider,
            'provider_label'   => match ($meeting->provider) {
                'google_meet' => 'Google Meet',
                'zoom'        => 'Zoom',
                'teams'       => 'Microsoft Teams',
                default       => $meeting->provider,
            },
            'meeting_url'      => $meeting->status === 'scheduled' ? $meeting->meeting_url : null,
            'status'           => $meeting->status,
            'google_calendar_url'=> $meeting->status === 'scheduled' ? $meeting->googleCalendarUrl() : null,
            'consultant'       => [
                'name'         => $meeting->consultant->name,
                'company_name' => $meeting->consultant->company_name,
            ],
            'client_name' => $meeting->clientProfile->user->name ?? null,
        ]);
    }
}

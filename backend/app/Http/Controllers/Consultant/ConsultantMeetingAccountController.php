<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ConsultantMeetingAccount;
use App\Services\ClientMeetingService;
use App\Services\Meetings\GoogleMeetIntegrationService;
use App\Services\Meetings\MeetingSchedulerService;
use App\Services\Meetings\TeamsMeetingIntegrationService;
use App\Services\Meetings\ZoomMeetingIntegrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantMeetingAccountController extends Controller
{
    public function __construct(
        private ClientMeetingService $meetings,
        private MeetingSchedulerService $scheduler,
        private GoogleMeetIntegrationService $google,
        private ZoomMeetingIntegrationService $zoom,
        private TeamsMeetingIntegrationService $teams,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $account = $this->meetings->meetingAccountFor($request->user());

        return response()->json(self::formatAccount($account));
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'preferred_provider' => 'nullable|in:google_meet,zoom,teams',
        ]);

        $account = $this->meetings->meetingAccountFor($request->user());
        $account->update($data);

        return response()->json(self::formatAccount($account->fresh()));
    }

    public static function formatAccount(ConsultantMeetingAccount $account): array
    {
        $scheduler = app(MeetingSchedulerService::class);
        $google    = app(GoogleMeetIntegrationService::class);
        $zoom      = app(ZoomMeetingIntegrationService::class);
        $teams     = app(TeamsMeetingIntegrationService::class);

        return [
            'preferred_provider' => $account->preferred_provider,
            'google_meet_ready'  => $scheduler->isReadyFor($account, 'google_meet'),
            'zoom_ready'         => $scheduler->isReadyFor($account, 'zoom'),
            'teams_ready'        => $scheduler->isReadyFor($account, 'teams'),
            'google_connected'   => $scheduler->isOAuthConnected($account, 'google_meet'),
            'zoom_connected'     => $scheduler->isOAuthConnected($account, 'zoom'),
            'teams_connected'    => $scheduler->isOAuthConnected($account, 'teams'),
            'google_account_email' => $account->google_account_email,
            'zoom_account_email'   => $account->zoom_account_email,
            'teams_account_email'  => $account->teams_account_email,
            'google_configured'  => $google->isConfigured(),
            'zoom_configured'    => $zoom->isConfigured(),
            'teams_configured'   => $teams->isConfigured(),
        ];
    }
}

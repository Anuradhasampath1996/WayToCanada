<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ConsultantMeetingAccount;
use App\Services\ClientMeetingService;
use App\Services\Meetings\GoogleMeetIntegrationService;
use App\Services\Meetings\MeetingOAuthStateService;
use App\Services\Meetings\TeamsMeetingIntegrationService;
use App\Services\Meetings\ZoomMeetingIntegrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ConsultantMeetingOAuthController extends Controller
{
    public function __construct(
        private ClientMeetingService $meetings,
        private MeetingOAuthStateService $state,
        private GoogleMeetIntegrationService $google,
        private ZoomMeetingIntegrationService $zoom,
        private TeamsMeetingIntegrationService $teams,
    ) {}

    public function connect(Request $request, string $provider): JsonResponse
    {
        $this->assertProvider($provider);
        $service = $this->serviceFor($provider);

        if (! $service->isConfigured()) {
            return response()->json([
                'message' => ucfirst(str_replace('_', ' ', $provider)) . ' OAuth is not configured on the server. Ask your administrator to add API credentials.',
            ], 503);
        }

        $state = $this->state->issue($request->user()->id, $provider);

        return response()->json(['url' => $service->authorizeUrl($state)]);
    }

    public function callback(Request $request, string $provider): RedirectResponse
    {
        $this->assertProvider($provider);
        $dashboard = rtrim(env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/');
        $returnUrl = $dashboard . '/dashboard/account';

        if ($request->filled('error')) {
            return redirect($returnUrl . '?meet_oauth=' . $provider . '&status=error&message=' . urlencode($request->input('error_description', $request->input('error'))));
        }

        $stateData = $this->state->consume((string) $request->input('state', ''));
        if (! $stateData || $stateData['provider'] !== $provider) {
            return redirect($returnUrl . '?meet_oauth=' . $provider . '&status=error&message=invalid_state');
        }

        try {
            $tokens  = $this->serviceFor($provider)->handleCallback((string) $request->input('code'));
            $account = ConsultantMeetingAccount::where('user_id', $stateData['user_id'])->firstOrFail();
            $this->serviceFor($provider)->storeTokens($account, $tokens);
        } catch (\Throwable $e) {
            return redirect($returnUrl . '?meet_oauth=' . $provider . '&status=error&message=' . urlencode($e->getMessage()));
        }

        return redirect($returnUrl . '?meet_oauth=' . $provider . '&status=success');
    }

    public function disconnect(Request $request, string $provider): JsonResponse
    {
        $this->assertProvider($provider);
        $account = $this->meetings->meetingAccountFor($request->user());
        $this->serviceFor($provider)->disconnect($account);

        return response()->json(ConsultantMeetingAccountController::formatAccount($account->fresh()));
    }

    private function assertProvider(string $provider): void
    {
        if (! in_array($provider, ['google', 'zoom', 'teams'], true)) {
            abort(404);
        }
    }

    private function serviceFor(string $provider): GoogleMeetIntegrationService|ZoomMeetingIntegrationService|TeamsMeetingIntegrationService
    {
        return match ($provider) {
            'google' => $this->google,
            'zoom'   => $this->zoom,
            'teams'  => $this->teams,
        };
    }
}

<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ClientActivityLog;
use App\Models\ClientProfile;
use App\Services\ClientActivity\ClientActivityRecorder;
use App\Services\ClientActivity\ClientActivityReportPdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ConsultantClientActivityController extends Controller
{
    public function __construct(
        private ClientActivityRecorder $recorder,
        private ClientActivityReportPdfService $pdfService,
    ) {}

    /**
     * GET /api/v1/consultant/clients/{profile}/activity-log
     * Immutable audit trail for dispute resolution and CICC compliance review.
     */
    public function index(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $this->recorder->syncHistorical($profile);

        $query = ClientActivityLog::where('client_profile_id', $profile->id)
            ->orderByDesc('occurred_at')
            ->orderByDesc('id');

        if ($actor = $request->query('actor')) {
            $query->where('actor_type', $actor);
        }

        if ($type = $request->query('event_type')) {
            $query->where('event_type', $type);
        }

        if ($category = $request->query('category')) {
            $types = collect(\App\Enums\ClientActivityType::cases())
                ->filter(fn ($t) => $t->category() === $category)
                ->map(fn ($t) => $t->value)
                ->all();
            $query->whereIn('event_type', $types);
        }

        if ($from = $request->query('from')) {
            $query->where('occurred_at', '>=', $from);
        }

        if ($to = $request->query('to')) {
            $query->where('occurred_at', '<=', $to . ' 23:59:59');
        }

        $paginated = $query->paginate(min((int) $request->query('per_page', 50), 100));

        $profile->loadMissing('user');

        return response()->json([
            'client' => [
                'id'           => $profile->id,
                'name'         => $profile->user?->name,
                'email'        => $profile->user?->email,
                'registered_at'=> $profile->user?->created_at,
                'invited_at'   => $profile->invited_at,
            ],
            'summary' => [
                'total_events'    => ClientActivityLog::where('client_profile_id', $profile->id)->count(),
                'client_actions'  => ClientActivityLog::where('client_profile_id', $profile->id)->where('actor_type', 'client')->count(),
                'consultant_actions' => ClientActivityLog::where('client_profile_id', $profile->id)->where('actor_type', 'consultant')->count(),
            ],
            'compliance_note' => 'This report documents all recorded interactions between consultant and client on the WayToCanada portal, supporting transparency obligations under the CICC Code of Professional Conduct.',
            'data' => $paginated,
        ]);
    }

    /**
     * GET /api/v1/consultant/clients/{profile}/activity-log/pdf
     * Downloadable PDF for compliance and legal record-keeping.
     */
    public function downloadPdf(Request $request, ClientProfile $profile)
    {
        $this->authorizeConsultant($request, $profile);

        try {
            $this->recorder->syncHistorical($profile);

            $pdf = $this->pdfService->generate($profile, $request->user(), $request);

            return $pdf->download($this->pdfService->filename($profile));
        } catch (\Throwable $e) {
            Log::error('Client activity PDF failed', [
                'profile_id' => $profile->id,
                'error'      => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Could not generate the activity report PDF. Please try again.',
            ], 500);
        }
    }

    private function authorizeConsultant(Request $request, ClientProfile $profile): void
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }
    }
}

<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ConsultantClientRequest;
use App\Models\User;
use App\Services\ConsultantClientRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantClientRequestController extends Controller
{
    public function __construct(
        private ConsultantClientRequestService $service,
    ) {}

    /**
     * GET /api/v1/consultant/client-requests/pending-count
     */
    public function pendingCount(Request $request): JsonResponse
    {
        $this->ensureConsultant($request->user());

        $count = ConsultantClientRequest::query()
            ->where('consultant_id', $request->user()->id)
            ->where('status', ConsultantClientRequest::STATUS_PENDING)
            ->count();

        return response()->json(['count' => $count]);
    }

    /**
     * GET /api/v1/consultant/client-requests
     */
    public function index(Request $request): JsonResponse
    {
        $this->ensureConsultant($request->user());

        $query = ConsultantClientRequest::query()
            ->where('consultant_id', $request->user()->id)
            ->with('clientUser:id,name,email,phone,created_at')
            ->latest();

        if ($status = $request->query('status')) {
            if (in_array($status, [
                ConsultantClientRequest::STATUS_PENDING,
                ConsultantClientRequest::STATUS_ACCEPTED,
                ConsultantClientRequest::STATUS_DECLINED,
                ConsultantClientRequest::STATUS_CANCELLED,
            ], true)) {
                $query->where('status', $status);
            }
        }

        $paginated = $query->paginate(min((int) $request->query('per_page', 20), 50));
        $paginated->getCollection()->transform(fn (ConsultantClientRequest $r) => $this->formatRequest($r));

        return response()->json($paginated);
    }

    /**
     * POST /api/v1/consultant/client-requests/{consultantClientRequest}/accept
     */
    public function accept(Request $request, ConsultantClientRequest $consultantClientRequest): JsonResponse
    {
        $this->ensureConsultant($request->user());

        $profile = $this->service->accept($request->user(), $consultantClientRequest, $request);

        return response()->json([
            'message' => 'Client accepted. Their workspace is ready.',
            'client'  => $profile->load('user:id,name,email,phone,created_at'),
        ]);
    }

    /**
     * POST /api/v1/consultant/client-requests/{consultantClientRequest}/decline
     */
    public function decline(Request $request, ConsultantClientRequest $consultantClientRequest): JsonResponse
    {
        $this->ensureConsultant($request->user());

        $this->service->decline($request->user(), $consultantClientRequest);

        return response()->json(['message' => 'Request declined.']);
    }

    private function ensureConsultant(User $user): void
    {
        if (! $user->hasRole('rcic')) {
            abort(403, 'Only registered consultants can manage client requests.');
        }
    }

    /** @return array<string, mixed> */
    private function formatRequest(ConsultantClientRequest $request): array
    {
        return [
            'id'          => $request->id,
            'status'      => $request->status,
            'message'     => $request->message,
            'created_at'  => $request->created_at?->toIso8601String(),
            'responded_at'=> $request->responded_at?->toIso8601String(),
            'client'      => $request->clientUser ? [
                'id'         => $request->clientUser->id,
                'name'       => $request->clientUser->name,
                'email'      => $request->clientUser->email,
                'phone'      => $request->clientUser->phone,
                'created_at' => $request->clientUser->created_at?->toIso8601String(),
            ] : null,
        ];
    }
}

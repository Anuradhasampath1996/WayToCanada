<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\ConsultantClientRequest;
use App\Models\User;
use App\Services\ConsultantClientRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientConsultantRequestController extends Controller
{
    public function __construct(
        private ConsultantClientRequestService $service,
    ) {}

    /**
     * GET /api/v1/client/available-consultants
     */
    public function availableConsultants(Request $request): JsonResponse
    {
        $this->ensureClient($request->user());

        $search = trim((string) $request->query('search', ''));

        $query = User::role('rcic')
            ->where(function ($q) {
                $q->where('is_license_verified', true)
                    ->orWhereNotNull('rcic_number');
            })
            ->select([
                'id',
                'name',
                'rcic_number',
                'avatar',
                'company_name',
                'company_logo',
                'company_bio',
                'company_city',
                'company_province',
                'company_website',
            ])
            ->orderBy('name');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('company_name', 'ilike', "%{$search}%")
                    ->orWhere('rcic_number', 'ilike', "%{$search}%")
                    ->orWhere('company_city', 'ilike', "%{$search}%");
            });
        }

        $consultants = $query->paginate(min((int) $request->query('per_page', 12), 50));

        return response()->json($consultants);
    }

    /**
     * GET /api/v1/client/consultant-request
     */
    public function current(Request $request): JsonResponse
    {
        $this->ensureClient($request->user());

        $pending = ConsultantClientRequest::query()
            ->where('client_user_id', $request->user()->id)
            ->where('status', ConsultantClientRequest::STATUS_PENDING)
            ->with('consultant:id,name,rcic_number,company_name,company_logo,avatar,company_city,company_province,company_bio')
            ->latest()
            ->first();

        return response()->json([
            'pending_request' => $pending ? $this->formatRequest($pending) : null,
        ]);
    }

    /**
     * POST /api/v1/client/consultant-request
     */
    public function store(Request $request): JsonResponse
    {
        $this->ensureClient($request->user());

        $validated = $request->validate([
            'consultant_id' => ['required', 'integer', 'exists:users,id'],
            'message'       => ['nullable', 'string', 'max:1000'],
        ]);

        $created = $this->service->createRequest(
            $request->user(),
            (int) $validated['consultant_id'],
            $validated['message'] ?? null,
        );

        return response()->json([
            'message' => 'Request sent. Your consultant will review and accept your request.',
            'data'    => $this->formatRequest($created),
        ], 201);
    }

    /**
     * POST /api/v1/client/consultant-request/{consultantClientRequest}/cancel
     */
    public function cancel(Request $request, ConsultantClientRequest $consultantClientRequest): JsonResponse
    {
        $this->ensureClient($request->user());

        $this->service->cancelRequest($request->user(), $consultantClientRequest);

        return response()->json(['message' => 'Request cancelled. You can choose another consultant.']);
    }

    private function ensureClient(User $user): void
    {
        if (! $user->hasRole('client')) {
            abort(403, 'This area is for client accounts only.');
        }
    }

    /** @return array<string, mixed> */
    private function formatRequest(ConsultantClientRequest $request): array
    {
        return [
            'id'         => $request->id,
            'status'     => $request->status,
            'message'    => $request->message,
            'created_at' => $request->created_at?->toIso8601String(),
            'consultant' => $request->consultant ? [
                'id'              => $request->consultant->id,
                'name'            => $request->consultant->name,
                'rcic_number'     => $request->consultant->rcic_number,
                'company_name'    => $request->consultant->company_name,
                'company_logo'    => $request->consultant->company_logo,
                'avatar'          => $request->consultant->avatar,
                'company_city'    => $request->consultant->company_city,
                'company_province'=> $request->consultant->company_province,
                'company_bio'     => $request->consultant->company_bio,
            ] : null,
        ];
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientPaymentRequest;
use App\Support\AdminCsvExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminClientPaymentRequestsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = $this->filteredQuery($request);
        $requests = $query->paginate($request->integer('per_page', 20));

        $paidTotal = (float) ClientPaymentRequest::where('status', 'paid')
            ->selectRaw('COALESCE(SUM(amount), 0) as total')
            ->value('total');

        return response()->json([
            'data' => collect($requests->items())->map(fn (ClientPaymentRequest $r) => $this->formatRow($r))->values(),
            'meta' => [
                'current_page' => $requests->currentPage(),
                'last_page'    => $requests->lastPage(),
                'per_page'     => $requests->perPage(),
                'total'        => $requests->total(),
            ],
            'stats' => [
                'total_paid'      => ClientPaymentRequest::where('status', 'paid')->count(),
                'total_pending'   => ClientPaymentRequest::whereIn('status', ['pending', 'awaiting_confirmation'])->count(),
                'total_revenue'   => round($paidTotal, 2),
                'total_cancelled' => ClientPaymentRequest::where('status', 'cancelled')->count(),
            ],
        ]);
    }

    public function export(Request $request)
    {
        $rows = $this->filteredQuery($request)->limit(5000)->get();

        return AdminCsvExport::download(
            'client-payment-requests-' . now()->format('Y-m-d') . '.csv',
            ['ID', 'Consultant', 'Consultant email', 'Client', 'Client email', 'Title', 'Provider', 'Status', 'Amount', 'Currency', 'Paid at'],
            $rows->map(fn (ClientPaymentRequest $r) => [
                $r->id,
                $r->consultant?->name,
                $r->consultant?->email,
                $r->clientProfile?->user?->name,
                $r->clientProfile?->user?->email,
                $r->title,
                $r->provider,
                $r->status,
                (float) $r->amount,
                $r->currency,
                $r->paid_at?->toIso8601String(),
            ]),
        );
    }

    private function filteredQuery(Request $request)
    {
        $query = ClientPaymentRequest::with([
            'consultant:id,name,email',
            'clientProfile.user:id,name,email',
            'caseFile:id',
        ])->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('provider')) {
            $query->where('provider', $request->provider);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'ilike', "%{$search}%")
                    ->orWhereHas('consultant', fn ($u) => $u
                        ->where('name', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%"))
                    ->orWhereHas('clientProfile.user', fn ($u) => $u
                        ->where('name', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%"));
            });
        }

        AdminCsvExport::applyDateFilters($query, $request->date_from, $request->date_to, 'paid_at');

        return $query;
    }

    /** @return array<string, mixed> */
    private function formatRow(ClientPaymentRequest $r): array
    {
        return [
            'id'           => $r->id,
            'title'        => $r->title,
            'amount'       => (float) $r->amount,
            'currency'     => $r->currency,
            'provider'     => $r->provider,
            'status'       => $r->status,
            'paid_at'      => $r->paid_at?->toIso8601String(),
            'sent_at'      => $r->sent_at?->toIso8601String(),
            'created_at'   => $r->created_at?->toIso8601String(),
            'consultant'   => $r->consultant ? [
                'id'    => $r->consultant->id,
                'name'  => $r->consultant->name,
                'email' => $r->consultant->email,
            ] : null,
            'client'       => $r->clientProfile?->user ? [
                'name'  => $r->clientProfile->user->name,
                'email' => $r->clientProfile->user->email,
            ] : null,
            'case_file_id' => $r->case_file_id,
        ];
    }
}

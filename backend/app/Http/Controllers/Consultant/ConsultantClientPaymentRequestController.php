<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Mail\ClientPaymentRequestEmail;
use App\Models\CaseFile;
use App\Models\ClientPaymentRequest;
use App\Models\ClientProfile;
use App\Services\ClientPaymentRequestService;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\Notifications\WorkspaceNotificationTriggers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ConsultantClientPaymentRequestController extends Controller
{
    public function __construct(
        private ClientPaymentRequestService $payments,
        private WorkspaceNotificationTriggers $notify,
        private ClientActivityTriggers $activity,
    ) {}

    public function index(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->payments->authorizeConsultant($request->user(), $profile);

        $items = ClientPaymentRequest::where('client_profile_id', $profile->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($r) => $this->formatRequest($r));

        return response()->json(['data' => $items]);
    }

    public function store(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->payments->authorizeConsultant($request->user(), $profile);

        $data = $request->validate([
            'title'       => 'required|string|max:200',
            'description' => 'nullable|string|max:2000',
            'amount'      => 'required|numeric|min:1|max:999999',
            'currency'    => 'nullable|string|size:3',
            'provider'         => 'nullable|in:stripe,paypal,interac',
            'payment_purpose'  => 'nullable|in:general,trust_deposit',
            'send_email'       => 'nullable|boolean',
        ]);

        $account = $this->payments->paymentAccountFor($request->user());
        $provider = $data['provider'] ?? $account->preferred_provider ?? 'stripe';

        if (! $account->isReadyFor($provider)) {
            return response()->json([
                'message' => "Your {$provider} payment account is not set up. Connect it in Account → Payment settings.",
            ], 422);
        }

        $caseFile = CaseFile::firstOrCreate(
            ['client_profile_id' => $profile->id],
            ['consultant_id' => $request->user()->id, 'status' => 'PENDING_ASSESSMENT']
        );

        $paymentRequest = ClientPaymentRequest::create([
            'case_file_id'      => $caseFile->id,
            'client_profile_id' => $profile->id,
            'consultant_id'     => $request->user()->id,
            'title'             => $data['title'],
            'description'       => $data['description'] ?? null,
            'amount'            => $data['amount'],
            'currency'          => strtoupper($data['currency'] ?? 'CAD'),
            'provider'          => $provider,
            'payment_purpose'   => $data['payment_purpose'] ?? 'general',
            'status'            => 'pending',
            'sent_at'           => now(),
        ]);

        $profile->load('user');

        if ($request->boolean('send_email', true) && $profile->user?->email) {
            Mail::to($profile->user->email)
                ->send(new ClientPaymentRequestEmail($profile, $paymentRequest, $request->user()));
        }

        $this->notify->onPaymentRequested($profile, $paymentRequest, $request->user());
        $this->activity->onPaymentRequested($profile, $paymentRequest, $request->user(), $request);

        return response()->json($this->formatRequest($paymentRequest), 201);
    }

    public function cancel(Request $request, ClientProfile $profile, ClientPaymentRequest $paymentRequest): JsonResponse
    {
        $this->payments->authorizeConsultant($request->user(), $profile);
        $this->authorizeRequest($profile, $paymentRequest);

        if ($paymentRequest->status === 'paid') {
            return response()->json(['message' => 'Paid requests cannot be cancelled.'], 422);
        }

        $paymentRequest->update([
            'status'       => 'cancelled',
            'cancelled_at' => now(),
        ]);

        return response()->json($this->formatRequest($paymentRequest->fresh()));
    }

    public function markPaid(Request $request, ClientProfile $profile, ClientPaymentRequest $paymentRequest): JsonResponse
    {
        $this->payments->authorizeConsultant($request->user(), $profile);
        $this->authorizeRequest($profile, $paymentRequest);

        $this->payments->markPaid($paymentRequest);

        return response()->json($this->formatRequest($paymentRequest->fresh()));
    }

    public function resend(Request $request, ClientProfile $profile, ClientPaymentRequest $paymentRequest): JsonResponse
    {
        $this->payments->authorizeConsultant($request->user(), $profile);
        $this->authorizeRequest($profile, $paymentRequest);

        if (! $paymentRequest->isPayable()) {
            return response()->json(['message' => 'This payment request is no longer active.'], 422);
        }

        $profile->load('user');

        if ($profile->user?->email) {
            Mail::to($profile->user->email)
                ->send(new ClientPaymentRequestEmail($profile, $paymentRequest, $request->user()));
        }

        $paymentRequest->update(['sent_at' => now()]);

        return response()->json(['message' => 'Payment request email sent.', 'data' => $this->formatRequest($paymentRequest->fresh())]);
    }

    private function authorizeRequest(ClientProfile $profile, ClientPaymentRequest $paymentRequest): void
    {
        if ((int) $paymentRequest->client_profile_id !== (int) $profile->id) {
            abort(404);
        }
    }

    private function formatRequest(ClientPaymentRequest $request): array
    {
        return [
            'id'          => $request->id,
            'title'       => $request->title,
            'description' => $request->description,
            'amount'      => (float) $request->amount,
            'currency'    => $request->currency,
            'provider'         => $request->provider,
            'payment_purpose'  => $request->payment_purpose ?? 'general',
            'status'           => $request->status,
            'pay_url'     => $request->publicUrl(),
            'paid_at'     => $request->paid_at?->toIso8601String(),
            'sent_at'     => $request->sent_at?->toIso8601String(),
            'created_at'  => $request->created_at?->toIso8601String(),
        ];
    }
}

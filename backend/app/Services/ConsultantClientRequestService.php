<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\ConsultantClientRequest;
use App\Models\User;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\Notifications\WorkspaceNotificationTriggers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ConsultantClientRequestService
{
    public function __construct(
        private WorkspaceNotificationTriggers $notify,
        private ClientActivityTriggers $activity,
    ) {}

    public function createRequest(User $client, int $consultantId, ?string $message = null): ConsultantClientRequest
    {
        if (! $client->hasRole('client')) {
            abort(403, 'Only client accounts can request a consultant.');
        }

        if (ClientProfile::where('user_id', $client->id)->where('consultant_id', $consultantId)->exists()) {
            throw ValidationException::withMessages([
                'consultant_id' => ['You are already assigned to this consultant.'],
            ]);
        }

        $consultant = User::role('rcic')
            ->where('id', $consultantId)
            ->where(function ($q) {
                $q->where('is_license_verified', true)
                    ->orWhereNotNull('rcic_number');
            })
            ->first();

        if (! $consultant) {
            throw ValidationException::withMessages([
                'consultant_id' => ['Selected consultant is not available.'],
            ]);
        }

        $existingPending = ConsultantClientRequest::query()
            ->where('client_user_id', $client->id)
            ->where('status', ConsultantClientRequest::STATUS_PENDING)
            ->first();

        if ($existingPending) {
            if ($existingPending->consultant_id === $consultantId) {
                return $existingPending->load('consultant:id,name,rcic_number,company_name,company_logo,avatar,company_city,company_province');
            }

            throw ValidationException::withMessages([
                'consultant_id' => ['You already have a pending request. Cancel it before choosing another consultant.'],
            ]);
        }

        $request = ConsultantClientRequest::create([
            'client_user_id' => $client->id,
            'consultant_id'  => $consultant->id,
            'status'         => ConsultantClientRequest::STATUS_PENDING,
            'message'        => $message,
        ]);

        $request->load('clientUser:id,name,email,phone', 'consultant:id,name,rcic_number,company_name,company_logo,avatar,company_city,company_province');

        $this->notify->onClientConsultantRequest($request);

        return $request;
    }

    public function cancelRequest(User $client, ConsultantClientRequest $request): ConsultantClientRequest
    {
        $this->ensureClientOwnsRequest($client, $request);

        if (! $request->isPending()) {
            throw ValidationException::withMessages([
                'request' => ['This request can no longer be cancelled.'],
            ]);
        }

        $request->update([
            'status'       => ConsultantClientRequest::STATUS_CANCELLED,
            'responded_at' => now(),
        ]);

        return $request->fresh();
    }

    public function accept(User $consultant, ConsultantClientRequest $request, Request $httpRequest): ClientProfile
    {
        $this->ensureConsultantOwnsRequest($consultant, $request);

        if (! $request->isPending()) {
            throw ValidationException::withMessages([
                'request' => ['This request has already been handled.'],
            ]);
        }

        return DB::connection('cws')->transaction(function () use ($consultant, $request, $httpRequest) {
            $clientUser = User::lockForUpdate()->findOrFail($request->client_user_id);

            if (ClientProfile::where('user_id', $clientUser->id)->where('consultant_id', $consultant->id)->exists()) {
                $request->update([
                    'status'       => ConsultantClientRequest::STATUS_CANCELLED,
                    'responded_at' => now(),
                ]);

                throw ValidationException::withMessages([
                    'request' => ['This client is already assigned to you.'],
                ]);
            }

            $profile = ClientProfile::create([
                'user_id'       => $clientUser->id,
                'consultant_id' => $consultant->id,
                'phone'         => $clientUser->phone,
                'invited_at'    => now(),
            ]);

            $clientUser->update(['consultant_id' => $consultant->id]);

            CaseFile::firstOrCreate(
                ['client_profile_id' => $profile->id],
                ['consultant_id' => $consultant->id, 'status' => 'PENDING_ASSESSMENT']
            );

            $request->update([
                'status'       => ConsultantClientRequest::STATUS_ACCEPTED,
                'responded_at' => now(),
            ]);

            ConsultantClientRequest::query()
                ->where('client_user_id', $clientUser->id)
                ->where('id', '!=', $request->id)
                ->where('status', ConsultantClientRequest::STATUS_PENDING)
                ->update([
                    'status'       => ConsultantClientRequest::STATUS_CANCELLED,
                    'responded_at' => now(),
                ]);

            $profile->load('user:id,name,email,phone');

            $this->activity->onClientInvited($profile, $consultant, $httpRequest);
            $this->notify->onClientConsultantRequestAccepted($request->fresh(['clientUser', 'consultant']), $profile);

            return $profile;
        });
    }

    public function decline(User $consultant, ConsultantClientRequest $request): ConsultantClientRequest
    {
        $this->ensureConsultantOwnsRequest($consultant, $request);

        if (! $request->isPending()) {
            throw ValidationException::withMessages([
                'request' => ['This request has already been handled.'],
            ]);
        }

        $request->update([
            'status'       => ConsultantClientRequest::STATUS_DECLINED,
            'responded_at' => now(),
        ]);

        $request->load('clientUser:id,name,email', 'consultant:id,name,rcic_number');

        $this->notify->onClientConsultantRequestDeclined($request);

        return $request;
    }

    private function ensureClientOwnsRequest(User $client, ConsultantClientRequest $request): void
    {
        if ($request->client_user_id !== $client->id) {
            abort(404, 'Request not found.');
        }
    }

    private function ensureConsultantOwnsRequest(User $consultant, ConsultantClientRequest $request): void
    {
        if ($request->consultant_id !== $consultant->id) {
            abort(404, 'Request not found.');
        }
    }
}

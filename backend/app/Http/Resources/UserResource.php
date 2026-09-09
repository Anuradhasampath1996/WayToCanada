<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'name'                => $this->name,
            'email'               => $this->email,
            'avatar'              => $this->avatar,
            'locale'              => $this->locale,
            'is_verified'         => $this->is_verified,
            'rcic_number'         => $this->rcic_number,
            'is_license_verified' => $this->is_license_verified,
            'roles'               => $this->getRoleNames(),
            'has_password'        => $this->hasPassword(),
            'auth_providers'      => $this->authProviders(),
            'assigned_consultant' => $this->assignedConsultantPayload(),
            'created_at'          => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * Prefer the consultant on the client's practice profile; fall back to users.consultant_id.
     *
     * @return array{id:int,name:string,email:string}|null
     */
    private function assignedConsultantPayload(): ?array
    {
        if ($this->relationLoaded('clientProfiles') && $this->clientProfiles->isNotEmpty()) {
            $profiles = $this->clientProfiles;
            $profile = $this->consultant_id
                ? ($profiles->firstWhere('consultant_id', $this->consultant_id) ?? $profiles->sortByDesc('id')->first())
                : $profiles->sortByDesc('id')->first();

            if ($profile && $profile->relationLoaded('consultant') && $profile->consultant) {
                return [
                    'id'    => $profile->consultant->id,
                    'name'  => $profile->consultant->name,
                    'email' => $profile->consultant->email,
                ];
            }
        }

        if ($this->relationLoaded('assignedConsultant') && $this->assignedConsultant) {
            return [
                'id'    => $this->assignedConsultant->id,
                'name'  => $this->assignedConsultant->name,
                'email' => $this->assignedConsultant->email,
            ];
        }

        return null;
    }
}

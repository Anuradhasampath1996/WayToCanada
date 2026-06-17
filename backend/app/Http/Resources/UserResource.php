<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'email'       => $this->email,
            'avatar'      => $this->avatar,
            'locale'      => $this->locale,
            'is_verified'         => $this->is_verified,
            'rcic_number'         => $this->rcic_number,
            'is_license_verified' => $this->is_license_verified,
            'locale'              => $this->locale,
            'roles'               => $this->getRoleNames(),
            'has_password'        => $this->hasPassword(),
            'auth_providers'      => $this->authProviders(),
            'created_at'          => $this->created_at?->toIso8601String(),
        ];
    }
}

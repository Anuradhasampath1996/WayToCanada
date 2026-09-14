<?php

namespace App\Services\Team;

use App\Models\ConsultantWorkspace;
use App\Models\User;

class TeamWorkspaceService
{
    public function ensureForOwner(User $owner): ConsultantWorkspace
    {
        $existing = ConsultantWorkspace::query()->where('owner_user_id', $owner->id)->first();
        if ($existing) {
            return $existing;
        }

        $name = trim((string) ($owner->company_name ?: $owner->name)) ?: 'Practice workspace';

        return ConsultantWorkspace::query()->create([
            'owner_user_id' => $owner->id,
            'name' => $name,
        ]);
    }

    public function forOwnerId(int $ownerUserId): ?ConsultantWorkspace
    {
        return ConsultantWorkspace::query()->where('owner_user_id', $ownerUserId)->first();
    }
}

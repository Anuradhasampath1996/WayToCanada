<?php

namespace App\Services\Academy;

use App\Models\Academy\AcademyContentSourceLink;
use App\Models\Academy\AcademyLegalSource;
use App\Models\Academy\AcademyOutdatedFlag;
use App\Models\User;

class AcademyOutdatedService
{
    public function markSource(AcademyLegalSource $source, string $reason, User $actor): int
    {
        $source->update(['status' => 'outdated']);
        $links = AcademyContentSourceLink::query()->where('legal_source_id', $source->id)->get();
        foreach ($links as $link) {
            AcademyOutdatedFlag::query()->updateOrCreate(
                [
                    'legal_source_id' => $source->id,
                    'linkable_type' => $link->linkable_type,
                    'linkable_id' => $link->linkable_id,
                    'status' => 'pending',
                ],
                [
                    'reason' => $reason,
                    'flagged_at' => now(),
                ]
            );
        }

        return $links->count();
    }
}

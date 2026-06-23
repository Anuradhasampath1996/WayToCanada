<?php

namespace App\Services;

use App\Models\ClientProfile;

class LmsPathwayGate
{
    public static function isUnlocked(?ClientProfile $profile): bool
    {
        if (! $profile) {
            return false;
        }

        $profile->loadMissing('caseFile');

        return (bool) $profile->caseFile?->immigration_pathway;
    }

    public static function assertForProfile(ClientProfile $profile): void
    {
        if (! self::isUnlocked($profile)) {
            abort(403, 'Assign an immigration pathway before using exam prep courses.');
        }
    }
}

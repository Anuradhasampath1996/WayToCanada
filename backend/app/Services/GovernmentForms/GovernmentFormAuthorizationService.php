<?php

namespace App\Services\GovernmentForms;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

class GovernmentFormAuthorizationService
{
    public function authorizeConsultantForProfile(User $consultant, ClientProfile $profile): void
    {
        if ($profile->consultant_id !== $consultant->id) {
            throw new AuthorizationException('Access denied for this client profile.');
        }
    }

    public function resolveCaseFile(ClientProfile $profile, ?int $caseFileId = null): CaseFile
    {
        if ($caseFileId !== null) {
            $caseFile = CaseFile::where('id', $caseFileId)
                ->where('client_profile_id', $profile->id)
                ->first();

            if (! $caseFile) {
                throw new AuthorizationException('Case file not found for this client.');
            }

            return $caseFile;
        }

        $caseFile = $profile->caseFile;

        if (! $caseFile) {
            throw new AuthorizationException('No active case file for this client.');
        }

        return $caseFile;
    }
}

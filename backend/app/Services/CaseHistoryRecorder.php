<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\CaseHistoryEvent;
use App\Models\User;

class CaseHistoryRecorder
{
    public function record(
        CaseFile $caseFile,
        string $eventType,
        string $title,
        ?string $description = null,
        ?User $actor = null,
        array $payload = [],
    ): CaseHistoryEvent {
        $caseFile->loadMissing('clientProfile');

        return CaseHistoryEvent::create([
            'case_file_id' => $caseFile->id,
            'client_profile_id' => $caseFile->client_profile_id,
            'actor_user_id' => $actor?->id,
            'event_type' => $eventType,
            'title' => $title,
            'description' => $description,
            'payload' => $payload === [] ? null : $payload,
            'occurred_at' => now(),
        ]);
    }
}

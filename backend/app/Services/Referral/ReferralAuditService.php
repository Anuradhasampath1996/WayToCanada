<?php

namespace App\Services\Referral;

use App\Models\ReferralAuditEvent;
use Illuminate\Http\Request;

class ReferralAuditService
{
    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    public function record(
        string $action,
        string $subjectType,
        ?int $subjectId,
        ?array $before = null,
        ?array $after = null,
        ?int $actorId = null,
        ?string $ip = null,
    ): ReferralAuditEvent {
        return ReferralAuditEvent::query()->create([
            'actor_user_id' => $actorId,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'before' => $before,
            'after' => $after,
            'ip' => $ip,
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    public function recordFromRequest(
        Request $request,
        string $action,
        string $subjectType,
        ?int $subjectId,
        ?array $before = null,
        ?array $after = null,
    ): ReferralAuditEvent {
        return $this->record(
            $action,
            $subjectType,
            $subjectId,
            $before,
            $after,
            $request->user()?->id,
            $request->ip(),
        );
    }
}

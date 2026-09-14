<?php

namespace App\Services\Team;

use App\Models\TeamAuditEvent;
use Illuminate\Http\Request;

class TeamAuditService
{
    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    public function record(
        string $action,
        string $subjectType,
        ?int $subjectId,
        ?int $workspaceId,
        ?array $before = null,
        ?array $after = null,
        ?int $actorId = null,
        ?string $ip = null,
    ): TeamAuditEvent {
        return TeamAuditEvent::query()->create([
            'actor_user_id' => $actorId,
            'workspace_id' => $workspaceId,
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
        ?int $workspaceId,
        ?array $before = null,
        ?array $after = null,
    ): TeamAuditEvent {
        return $this->record(
            $action,
            $subjectType,
            $subjectId,
            $workspaceId,
            $before,
            $after,
            $request->user()?->id,
            $request->ip(),
        );
    }
}

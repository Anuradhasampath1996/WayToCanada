<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\Notifications\WorkspaceNotificationTriggers;
use Illuminate\Validation\ValidationException;

class CaseFileLifecycleService
{
    public const LIFECYCLE_ACTIVE = 'active';
    public const LIFECYCLE_ON_HOLD = 'on_hold';
    public const LIFECYCLE_CLOSED = 'closed';
    public const LIFECYCLE_COMPLETED = 'completed';

    public function __construct(
        private WorkspaceNotificationTriggers $notify,
        private ClientActivityTriggers $activity,
    ) {}

    /** @return array<string, string> */
    public static function lifecycleLabels(): array
    {
        return [
            self::LIFECYCLE_ACTIVE    => 'Active',
            self::LIFECYCLE_ON_HOLD   => 'On hold',
            self::LIFECYCLE_CLOSED    => 'Closed',
            self::LIFECYCLE_COMPLETED => 'Completed',
        ];
    }

    public function resolveActiveCaseFile(ClientProfile $profile, int $consultantId, bool $createIfMissing = true): ?CaseFile
    {
        $profile->loadMissing('caseFile');

        if ($profile->active_case_file_id) {
            $case = CaseFile::where('id', $profile->active_case_file_id)
                ->where('client_profile_id', $profile->id)
                ->first();
            if ($case) {
                return $case;
            }
        }

        $existing = CaseFile::where('client_profile_id', $profile->id)
            ->orderByDesc('case_number')
            ->first();

        if ($existing) {
            $profile->update(['active_case_file_id' => $existing->id]);

            return $existing;
        }

        if (! $createIfMissing) {
            return null;
        }

        return $this->createCase($profile, $consultantId);
    }

    public function createCase(ClientProfile $profile, int $consultantId): CaseFile
    {
        $nextNumber = (int) CaseFile::where('client_profile_id', $profile->id)->max('case_number') + 1;

        $case = CaseFile::create([
            'client_profile_id' => $profile->id,
            'consultant_id'     => $consultantId,
            'case_number'       => max(1, $nextNumber),
            'status'            => 'PENDING_ASSESSMENT',
            'lifecycle_status'  => self::LIFECYCLE_ACTIVE,
            'lifecycle_changed_at' => now(),
        ]);

        $profile->update(['active_case_file_id' => $case->id]);

        return $case;
    }

    /** @return list<array<string, mixed>> */
    public function listCasesForProfile(ClientProfile $profile): array
    {
        return CaseFile::where('client_profile_id', $profile->id)
            ->orderByDesc('case_number')
            ->get()
            ->map(fn (CaseFile $case) => $this->formatCaseSummary($case, $profile))
            ->values()
            ->all();
    }

    /** @return array<string, mixed> */
    public function formatCaseSummary(CaseFile $case, ClientProfile $profile): array
    {
        return [
            'id'                  => $case->id,
            'case_number'         => $case->case_number,
            'label'               => 'Case #' . $case->case_number,
            'status'              => $case->status,
            'lifecycle_status'    => $case->lifecycle_status,
            'lifecycle_label'     => self::lifecycleLabels()[$case->lifecycle_status] ?? $case->lifecycle_status,
            'lifecycle_note'      => $case->lifecycle_note,
            'lifecycle_changed_at'=> $case->lifecycle_changed_at?->toDateTimeString(),
            'immigration_pathway' => $case->immigration_pathway,
            'is_active'           => $profile->active_case_file_id === $case->id,
            'created_at'          => $case->created_at?->toDateTimeString(),
        ];
    }

    /** @return array<string, mixed> */
    public function lifecycleMeta(ClientProfile $profile, CaseFile $case): array
    {
        $hasActiveOther = CaseFile::where('client_profile_id', $profile->id)
            ->where('id', '!=', $case->id)
            ->where('lifecycle_status', self::LIFECYCLE_ACTIVE)
            ->exists();

        $canOpenNew = in_array($case->lifecycle_status, [self::LIFECYCLE_CLOSED, self::LIFECYCLE_COMPLETED], true)
            && ! $hasActiveOther;

        return [
            'status'            => $case->lifecycle_status,
            'label'             => self::lifecycleLabels()[$case->lifecycle_status] ?? $case->lifecycle_status,
            'note'              => $case->lifecycle_note,
            'changed_at'        => $case->lifecycle_changed_at?->toDateTimeString(),
            'can_hold'          => $case->lifecycle_status === self::LIFECYCLE_ACTIVE,
            'can_resume'        => $case->lifecycle_status === self::LIFECYCLE_ON_HOLD,
            'can_close'         => in_array($case->lifecycle_status, [self::LIFECYCLE_ACTIVE, self::LIFECYCLE_ON_HOLD], true),
            'can_complete'      => in_array($case->lifecycle_status, [self::LIFECYCLE_ACTIVE, self::LIFECYCLE_ON_HOLD], true),
            'can_open_new_case' => $canOpenNew,
            'case_count'        => CaseFile::where('client_profile_id', $profile->id)->count(),
        ];
    }

    public function updateLifecycle(
        ClientProfile $profile,
        CaseFile $case,
        string $action,
        ?string $note = null,
    ): CaseFile {
        if ($case->client_profile_id !== $profile->id) {
            throw ValidationException::withMessages(['case' => 'Case does not belong to this client.']);
        }

        $next = match ($action) {
            'hold'     => $this->hold($case, $note),
            'resume'   => $this->resume($case),
            'close'    => $this->close($case, $note),
            'complete' => $this->complete($case, $note),
            default    => throw ValidationException::withMessages(['action' => 'Invalid lifecycle action.']),
        };

        return $next->fresh();
    }

    public function switchActiveCase(ClientProfile $profile, int $caseFileId): CaseFile
    {
        $case = CaseFile::where('client_profile_id', $profile->id)
            ->where('id', $caseFileId)
            ->firstOrFail();

        $profile->update(['active_case_file_id' => $case->id]);

        return $case->fresh();
    }

    public function openNewCase(ClientProfile $profile, int $consultantId): CaseFile
    {
        $current = $this->resolveActiveCaseFile($profile, $consultantId, false);

        if (! $current) {
            return $this->createCase($profile, $consultantId);
        }

        if (! in_array($current->lifecycle_status, [self::LIFECYCLE_CLOSED, self::LIFECYCLE_COMPLETED], true)) {
            throw ValidationException::withMessages([
                'case' => 'Close or complete the current case before opening a new one.',
            ]);
        }

        $hasActive = CaseFile::where('client_profile_id', $profile->id)
            ->where('lifecycle_status', self::LIFECYCLE_ACTIVE)
            ->exists();

        if ($hasActive) {
            throw ValidationException::withMessages([
                'case' => 'An active case already exists for this client.',
            ]);
        }

        return $this->createCase($profile, $consultantId);
    }

    private function hold(CaseFile $case, ?string $note): CaseFile
    {
        if ($case->lifecycle_status !== self::LIFECYCLE_ACTIVE) {
            throw ValidationException::withMessages(['case' => 'Only active cases can be put on hold.']);
        }

        $case->update([
            'lifecycle_status'     => self::LIFECYCLE_ON_HOLD,
            'lifecycle_note'       => $note,
            'lifecycle_changed_at' => now(),
        ]);

        return $case;
    }

    private function resume(CaseFile $case): CaseFile
    {
        if ($case->lifecycle_status !== self::LIFECYCLE_ON_HOLD) {
            throw ValidationException::withMessages(['case' => 'Only cases on hold can be resumed.']);
        }

        $case->update([
            'lifecycle_status'     => self::LIFECYCLE_ACTIVE,
            'lifecycle_changed_at' => now(),
        ]);

        return $case;
    }

    private function close(CaseFile $case, ?string $note): CaseFile
    {
        if (! in_array($case->lifecycle_status, [self::LIFECYCLE_ACTIVE, self::LIFECYCLE_ON_HOLD], true)) {
            throw ValidationException::withMessages(['case' => 'This case cannot be closed.']);
        }

        $case->update([
            'lifecycle_status'     => self::LIFECYCLE_CLOSED,
            'lifecycle_note'       => $note,
            'lifecycle_changed_at' => now(),
        ]);

        return $case;
    }

    private function complete(CaseFile $case, ?string $note): CaseFile
    {
        if (! in_array($case->lifecycle_status, [self::LIFECYCLE_ACTIVE, self::LIFECYCLE_ON_HOLD], true)) {
            throw ValidationException::withMessages(['case' => 'This case cannot be marked complete.']);
        }

        $updates = [
            'lifecycle_status'     => self::LIFECYCLE_COMPLETED,
            'lifecycle_note'       => $note,
            'lifecycle_changed_at' => now(),
        ];

        if ($case->statusStep() < CaseFile::statusOrder()['APPLICATION_SUBMITTED']) {
            $updates['status'] = 'APPLICATION_SUBMITTED';
        }

        $case->update($updates);

        return $case;
    }
}

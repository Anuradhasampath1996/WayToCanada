<?php

namespace App\Services\Academy;

use App\Models\Academy\AcademyCourse;
use App\Models\Academy\AcademyEntitlement;
use App\Models\ConsultantSubscription;
use App\Models\User;
use App\Services\Team\TeamAccess;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AcademyAccess
{
    public function __construct(private TeamAccess $team) {}

    public function assertLearner(User $user): void
    {
        if ($user->hasRole('client')) {
            abort(404);
        }

        if ($user->hasRole('rcic')) {
            return;
        }

        if ($user->hasRole('staff')) {
            $member = $this->team->activeMembership($user);
            if (! $member) {
                abort(403, 'Staff membership is not active.');
            }
            if (! ($member->permissionMap()['academy.learn'] ?? false)) {
                abort(403, 'Academy access is not assigned.');
            }

            return;
        }

        abort(404);
    }

    public function assertAcademySurface(User $user): void
    {
        $this->assertLearner($user);
        if ($this->hasEligibleSubscription($user) || $this->hasActiveGrant($user)) {
            return;
        }
        abort(403, 'Academy entitlement is required.');
    }

    public function assertCourse(User $user, AcademyCourse $course, ?int $requestedVersionId = null): void
    {
        $this->assertLearner($user);

        if (! $course->isPublished()) {
            abort(404);
        }

        $tier = $course->access_tier;
        if ($tier === 'free') {
            return;
        }

        if ($tier === 'grant_required') {
            if ($this->hasActiveGrant($user, $course)) {
                return;
            }
            abort(403, 'This course requires an Academy grant.');
        }

        if ($this->hasEligibleSubscription($user) || $this->hasActiveGrant($user, $course)) {
            return;
        }

        abort(403, 'Academy entitlement is required.');
    }

    public function assertOwnUser(User $user, int $ownerUserId): void
    {
        if ((int) $user->id !== (int) $ownerUserId) {
            abort(404);
        }
    }

    public function hasEligibleSubscription(User $user): bool
    {
        $entitled = $this->team->entitlementUser($user);
        $sub = ConsultantSubscription::query()
            ->where('user_id', $entitled->id)
            ->whereIn('status', ['trial', 'active', 'past_due'])
            ->latest()
            ->first();

        return $sub?->isCurrentlyActive() === true;
    }

    public function hasActiveGrant(User $user, ?AcademyCourse $course = null): bool
    {
        $grants = AcademyEntitlement::query()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->get()
            ->filter(fn (AcademyEntitlement $row) => $row->isCurrentlyActive());

        if ($grants->isEmpty()) {
            return false;
        }

        if (! $course) {
            return true;
        }

        return $grants->contains(function (AcademyEntitlement $row) use ($course) {
            if (in_array($row->type, ['admin_grant', 'complimentary'], true) && ! $row->course_id && ! $row->track_id) {
                return true;
            }
            if ($row->course_id && (int) $row->course_id === (int) $course->id) {
                return true;
            }
            if ($row->track_id && $course->track_id && (int) $row->track_id === (int) $course->track_id) {
                return true;
            }

            return false;
        });
    }

    public function learnerId(User $user): int
    {
        return (int) $user->id;
    }
}

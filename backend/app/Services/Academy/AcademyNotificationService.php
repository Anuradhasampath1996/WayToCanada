<?php

namespace App\Services\Academy;

use App\Enums\NotificationType;
use App\Models\User;
use App\Services\Notifications\NotificationService;

class AcademyNotificationService
{
    public function __construct(private NotificationService $notifications) {}

    public function courseUnlocked(User $user, string $title): void
    {
        $this->notifications->dispatch(
            $user,
            NotificationType::ACADEMY_COURSE_UNLOCKED,
            'Academy course unlocked',
            $title.' is now available in RCIC Academy.',
            '/dashboard/academy/courses',
            'academy-unlock-'.$user->id.'-'.$title,
        );
    }

    public function courseCompleted(User $user, string $title): void
    {
        $this->notifications->dispatch(
            $user,
            NotificationType::ACADEMY_COURSE_COMPLETED,
            'Academy course completed',
            'You completed '.$title.'.',
            '/dashboard/academy/performance',
        );
    }

    public function questionReported(int $questionId): void
    {
        foreach ($this->admins() as $admin) {
            $this->notifications->dispatch(
                $admin,
                NotificationType::ACADEMY_QUESTION_REPORTED,
                'Academy question reported',
                'A learner reported question #'.$questionId.'.',
                '/admindashboard/academy',
                'academy-report-'.$questionId.'-'.$admin->id,
                null,
                ['in_app'],
            );
        }
    }

    public function legalReviewPending(string $label): void
    {
        foreach ($this->admins() as $admin) {
            $this->notifications->dispatch(
                $admin,
                NotificationType::ACADEMY_LEGAL_REVIEW_PENDING,
                'Academy legal review pending',
                $label.' is waiting for legal / RCIC review.',
                '/admindashboard/academy',
                null,
                null,
                ['in_app'],
            );
        }
    }

    public function sourceOutdated(string $title): void
    {
        foreach ($this->admins() as $admin) {
            $this->notifications->dispatch(
                $admin,
                NotificationType::ACADEMY_SOURCE_OUTDATED,
                'Academy source outdated',
                $title.' was marked outdated. Linked content is in the outdated queue.',
                '/admindashboard/academy',
                null,
                null,
                ['in_app'],
            );
        }
    }

    /** @return \Illuminate\Support\Collection<int, User> */
    private function admins()
    {
        return User::query()->role(['admin', 'super-admin'])->get();
    }
}

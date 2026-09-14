<?php

namespace App\Services\Lms\Ai;

use App\Services\Academy\Ai\Exceptions\AcademyAiException;

class LmsAiGuard
{
    public static function assertDraftOnly(string $reviewStatus, bool $isPublished = false): void
    {
        if ($isPublished || in_array($reviewStatus, ['approved', 'published'], true)) {
            throw new AcademyAiException('AI cannot approve or publish Client LMS content.');
        }
    }

    public static function denyPublish(): never
    {
        throw new AcademyAiException('AI cannot approve or publish Client LMS content.');
    }
}

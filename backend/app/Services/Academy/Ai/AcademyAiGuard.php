<?php

namespace App\Services\Academy\Ai;

use App\Services\Academy\Ai\Exceptions\AcademyAiException;

class AcademyAiGuard
{
    public static function assertDraftOnly(string $status): void
    {
        if (in_array($status, ['approved', 'published'], true)) {
            throw new AcademyAiException('AI cannot approve or publish Academy content.');
        }
    }

    public static function denyPublish(): never
    {
        throw new AcademyAiException('AI cannot approve or publish Academy content.');
    }
}

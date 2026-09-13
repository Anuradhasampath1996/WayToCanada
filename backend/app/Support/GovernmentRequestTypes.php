<?php

namespace App\Support;

use App\Models\CaseGovernmentRequest;

final class GovernmentRequestTypes
{
    public static function presets(): array
    {
        return CaseGovernmentRequest::TYPES;
    }

    public static function isKnown(string $type): bool
    {
        return isset(CaseGovernmentRequest::TYPES[$type]);
    }
}

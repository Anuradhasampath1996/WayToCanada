<?php

namespace App\Support;

/**
 * Shared pathway/package label matching.
 * Critical: "PNP - Non-Express Entry" must never be treated as Express Entry.
 */
final class ImmigrationPathwayLabels
{
    public static function mentionsExpressEntry(?string $text): bool
    {
        if ($text === null || $text === '') {
            return false;
        }

        $lower = mb_strtolower($text);

        // Strip "non-express entry" / "non express entry" phrases first.
        $stripped = preg_replace('/\bnon[\s\-–—]*express[\s\-–—]*entry\b/u', ' ', $lower) ?? $lower;

        return (bool) preg_match('/\bexpress[\s\-–—]*entry\b/u', $stripped);
    }

    public static function mentionsPnp(?string $text): bool
    {
        if ($text === null || $text === '') {
            return false;
        }

        $lower = mb_strtolower($text);

        return str_contains($lower, 'provincial nominee') || (bool) preg_match('/\bpnp\b/u', $lower);
    }
}

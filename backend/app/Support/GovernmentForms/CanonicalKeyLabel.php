<?php

namespace App\Support\GovernmentForms;

final class CanonicalKeyLabel
{
    public static function from(string $canonicalKey): string
    {
        $part = preg_replace('/^(applicant|representative)\./', '', $canonicalKey) ?? $canonicalKey;
        $part = str_replace('family.', '', $part);

        $part = preg_replace('/\bparent(\d+)\b/i', 'Parent $1', $part) ?? $part;

        // children.0 / siblings.0 -> Child 1 / Sibling 1 (1-based for display)
        $part = preg_replace_callback('/\bchildren\.(\d+)\b/i', static function (array $m): string {
            return 'Child '.(((int) $m[1]) + 1);
        }, $part) ?? $part;

        $part = preg_replace_callback('/\bsiblings\.(\d+)\b/i', static function (array $m): string {
            return 'Sibling '.(((int) $m[1]) + 1);
        }, $part) ?? $part;

        $part = str_replace(['_', '.', '-'], ' ', $part);
        $part = preg_replace('/\s+/', ' ', $part) ?? $part;
        $part = trim($part);

        $label = ucwords(strtolower($part), " \t\r\n\f\v");

        $label = str_ireplace('Contact Email', 'Email', $label);
        $label = str_ireplace('Address Full', 'Address', $label);
        $label = str_ireplace('Date Of Birth', 'Date of Birth', $label);
        $label = str_ireplace('Country Of Birth', 'Country of Birth', $label);
        $label = str_ireplace('Uci', 'UCI', $label);
        $label = str_ireplace('Rcic', 'RCIC', $label);
        $label = str_ireplace('Phone Country Code', 'Phone Country Code', $label);

        return $label;
    }
}

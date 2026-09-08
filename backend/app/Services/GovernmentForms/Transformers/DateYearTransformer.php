<?php

namespace App\Services\GovernmentForms\Transformers;

/** Emits YYYY from a Y-m-d (or parseable) date string. */
class DateYearTransformer implements FieldTransformer
{
    public function transform(mixed $value, array $context = []): mixed
    {
        $ts = self::timestamp($value);

        return $ts ? date('Y', $ts) : null;
    }

    private static function timestamp(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $ts = strtotime((string) $value);

        return $ts ?: null;
    }
}

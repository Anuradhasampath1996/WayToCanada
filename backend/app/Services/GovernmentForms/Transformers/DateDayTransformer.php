<?php

namespace App\Services\GovernmentForms\Transformers;

/** Emits DD (01-31) from a Y-m-d (or parseable) date string. */
class DateDayTransformer implements FieldTransformer
{
    public function transform(mixed $value, array $context = []): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }
        $ts = strtotime((string) $value);

        return $ts ? date('d', $ts) : null;
    }
}

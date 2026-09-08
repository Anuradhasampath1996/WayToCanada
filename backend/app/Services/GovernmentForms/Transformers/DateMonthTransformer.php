<?php

namespace App\Services\GovernmentForms\Transformers;

/** Emits MM (01-12) from a Y-m-d (or parseable) date string. */
class DateMonthTransformer implements FieldTransformer
{
    public function transform(mixed $value, array $context = []): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }
        $ts = strtotime((string) $value);

        return $ts ? date('m', $ts) : null;
    }
}

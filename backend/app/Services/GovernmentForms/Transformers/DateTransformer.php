<?php

namespace App\Services\GovernmentForms\Transformers;

class DateTransformer implements FieldTransformer
{
    public function transform(mixed $value, array $context = []): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        $format = $context['format'] ?? 'Y-m-d';
        $ts = strtotime((string) $value);

        return $ts ? date($format, $ts) : (string) $value;
    }
}

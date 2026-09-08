<?php

namespace App\Services\GovernmentForms\Transformers;

class NameTransformer implements FieldTransformer
{
    public function transform(mixed $value, array $context = []): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        $value = trim((string) $value);

        return mb_strtoupper($value, 'UTF-8');
    }
}

<?php

namespace App\Services\GovernmentForms\Transformers;

/**
 * IRCC UCI fields reject hyphens/spaces — digits only (Adobe XFA validation).
 */
class UciTransformer implements FieldTransformer
{
    public function transform(mixed $value, array $context = []): mixed
    {
        if ($value === null) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', (string) $value) ?? '';

        return $digits !== '' ? $digits : null;
    }
}

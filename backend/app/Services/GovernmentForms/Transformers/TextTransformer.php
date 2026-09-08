<?php

namespace App\Services\GovernmentForms\Transformers;

class TextTransformer implements FieldTransformer
{
    public function transform(mixed $value, array $context = []): mixed
    {
        if ($value === null) {
            return null;
        }

        return trim((string) $value);
    }
}

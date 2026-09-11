<?php

namespace App\Services\GovernmentForms\Transformers;

/** Map canonical gender to IRCC IMM0008 Sex dropdown labels. */
class SexTransformer implements FieldTransformer
{
    public function transform(mixed $value, array $context = []): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        $lower = strtolower(trim((string) $value));

        return match ($lower) {
            'male', 'm', 'man' => 'Male',
            'female', 'f', 'woman' => 'Female',
            'another', 'other', 'x', 'unspecified' => 'Another gender',
            default => ucfirst($lower),
        };
    }
}

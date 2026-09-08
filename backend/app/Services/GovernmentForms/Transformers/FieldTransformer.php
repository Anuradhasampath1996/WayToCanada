<?php

namespace App\Services\GovernmentForms\Transformers;

interface FieldTransformer
{
    public function transform(mixed $value, array $context = []): mixed;
}

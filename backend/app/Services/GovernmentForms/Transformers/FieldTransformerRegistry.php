<?php

namespace App\Services\GovernmentForms\Transformers;

class FieldTransformerRegistry
{
    /** @var array<string, FieldTransformer> */
    private array $transformers;

    public function __construct()
    {
        $this->transformers = [
            'text' => new TextTransformer(),
            'date' => new DateTransformer(),
            'date_yyyy' => new DateYearTransformer(),
            'date_mm' => new DateMonthTransformer(),
            'date_dd' => new DateDayTransformer(),
            'name' => new NameTransformer(),
            'uci' => new UciTransformer(),
            'sex' => new SexTransformer(),
        ];
    }

    public function transform(?string $transformerKey, mixed $value, array $context = []): mixed
    {
        if ($transformerKey === null || $transformerKey === '') {
            return $value;
        }

        $transformer = $this->transformers[$transformerKey] ?? null;

        if (! $transformer) {
            return $value;
        }

        return $transformer->transform($value, $context);
    }
}

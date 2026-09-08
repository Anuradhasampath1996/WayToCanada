<?php

namespace App\Services\GovernmentForms;

class SourceDataHasher
{
    /**
     * Produce a deterministic SHA-256 hash of normalized canonical values.
     *
     * @param  array<string, mixed>  $values
     */
    public function hash(array $values): string
    {
        $normalized = $this->normalize($values);

        return hash('sha256', json_encode($normalized, JSON_THROW_ON_ERROR));
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function normalize(array $values): array
    {
        ksort($values);

        $normalized = [];
        foreach ($values as $key => $value) {
            $normalized[$key] = $this->normalizeValue($value);
        }

        return $normalized;
    }

    private function normalizeValue(mixed $value): mixed
    {
        if (is_array($value)) {
            if ($this->isList($value)) {
                return array_map(fn ($item) => $this->normalizeValue($item), $value);
            }

            ksort($value);

            return array_map(fn ($item) => $this->normalizeValue($item), $value);
        }

        if (is_string($value)) {
            return trim($value);
        }

        return $value;
    }

    /** @param  array<mixed>  $array */
    private function isList(array $array): bool
    {
        return $array === [] || array_keys($array) === range(0, count($array) - 1);
    }
}

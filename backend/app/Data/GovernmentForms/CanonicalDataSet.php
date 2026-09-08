<?php

namespace App\Data\GovernmentForms;

use Carbon\Carbon;

final class CanonicalDataSet
{
    /**
     * @param  array<string, mixed>  $values  Dot-notation canonical keys
     * @param  array<string, mixed>  $sources  Which entities contributed
     */
    public function __construct(
        public readonly int $caseFileId,
        public readonly array $values,
        public readonly string $sourceHash,
        public readonly array $sources,
        public readonly Carbon $resolvedAt,
        public readonly bool $usesSnapshot,
    ) {}

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->values[$key] ?? $default;
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->values)
            && $this->values[$key] !== null
            && $this->values[$key] !== '';
    }
}

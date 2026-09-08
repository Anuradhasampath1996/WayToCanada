<?php

namespace App\Data\GovernmentForms;

final class FormReadinessResult
{
    /**
     * @param  array<int, array{key: string, label: string, source_section: string, responsible_party: string, redirect_hint: string|null}>  $missingFields
     * @param  list<array{section: string, count: int, capacity: int, label: string, message: string}>  $overflowWarnings
     */
    public function __construct(
        public readonly string $formCode,
        public readonly int $percentage,
        public readonly bool $ready,
        public readonly array $missingFields,
        public readonly int $requiredCount,
        public readonly int $filledCount,
        public readonly array $overflowWarnings = [],
        public readonly bool $blockedByOverflow = false,
    ) {}
}

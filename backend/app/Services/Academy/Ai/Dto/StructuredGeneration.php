<?php

namespace App\Services\Academy\Ai\Dto;

class StructuredGeneration
{
    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $usage
     */
    public function __construct(
        public array $data,
        public string $provider,
        public string $model,
        public array $usage = [],
        public ?string $requestId = null,
    ) {}
}

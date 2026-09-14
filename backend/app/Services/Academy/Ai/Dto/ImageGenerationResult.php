<?php

namespace App\Services\Academy\Ai\Dto;

class ImageGenerationResult
{
    public function __construct(
        public string $binary,
        public string $provider,
        public string $model,
        public string $prompt,
        public ?float $estimatedCostUsd = null,
        public ?string $requestId = null,
    ) {}
}

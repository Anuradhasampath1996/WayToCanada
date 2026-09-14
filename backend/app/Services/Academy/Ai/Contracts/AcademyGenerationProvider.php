<?php

namespace App\Services\Academy\Ai\Contracts;

use App\Services\Academy\Ai\Dto\ImageGenerationResult;
use App\Services\Academy\Ai\Dto\StructuredGeneration;

interface AcademyGenerationProvider
{
    public function configured(): bool;

    public function name(): string;

    /**
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $context
     */
    public function generateStructured(array $schema, string $schemaName, string $system, string $user, array $context = []): StructuredGeneration;

    /**
     * Independent validation call. Must not be given the generated correct answer.
     *
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $context
     */
    public function validateStructured(array $schema, string $schemaName, string $system, string $user, array $context = []): StructuredGeneration;

    /**
     * @param  array<string, mixed>  $options
     */
    public function generateImage(string $prompt, array $options = []): ImageGenerationResult;
}

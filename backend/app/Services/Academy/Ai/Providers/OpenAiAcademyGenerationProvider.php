<?php

namespace App\Services\Academy\Ai\Providers;

use App\Services\Academy\Ai\AcademyAiPromptCatalog;
use App\Services\Academy\Ai\Contracts\AcademyGenerationProvider;
use App\Services\Academy\Ai\Dto\ImageGenerationResult;
use App\Services\Academy\Ai\Dto\StructuredGeneration;
use App\Services\Academy\Ai\Exceptions\AcademyAiException;
use App\Services\Academy\Ai\Exceptions\AcademyAiRateLimited;
use App\Services\Academy\Ai\Exceptions\AcademyAiTimeout;
use App\Services\Academy\Ai\OpenAi\OpenAiResponsesClient;

class OpenAiAcademyGenerationProvider implements AcademyGenerationProvider
{
    public function __construct(private OpenAiResponsesClient $client) {}

    public function configured(): bool
    {
        return $this->client->configured();
    }

    public function name(): string
    {
        return 'openai';
    }

    public function generateStructured(array $schema, string $schemaName, string $system, string $user, array $context = []): StructuredGeneration
    {
        $role = (string) ($context['model_role'] ?? 'reasoning');
        $model = $this->modelFor($role);

        return $this->attempt($model, $schemaName, $schema, $system, $user);
    }

    public function validateStructured(array $schema, string $schemaName, string $system, string $user, array $context = []): StructuredGeneration
    {
        $model = $this->modelFor('validation');

        return $this->attempt($model, $schemaName, $schema, $system, $user);
    }

    public function generateImage(string $prompt, array $options = []): ImageGenerationResult
    {
        foreach (config('academy_ai.forbidden_image_terms', []) as $term) {
            if (str_contains(strtolower($prompt), strtolower((string) $term))) {
                throw new AcademyAiException('Image prompt contains a forbidden official/endorsement term.');
            }
        }

        $suffix = ' Do not generate government seals, official forms, credentials, exam screenshots, or imagery implying CICC, IRCC, or IRB endorsement.';

        return $this->client->image(
            (string) config('academy_ai.openai.image_model'),
            $prompt.$suffix,
            (string) ($options['size'] ?? '1024x1024'),
        );
    }

    /**
     * @param  array<string, mixed>  $schema
     */
    private function attempt(string $model, string $schemaName, array $schema, string $system, string $user): StructuredGeneration
    {
        try {
            return $this->client->structured($model, $schemaName, $schema, $system, $user);
        } catch (AcademyAiRateLimited|AcademyAiTimeout $e) {
            throw $e;
        } catch (AcademyAiException $e) {
            return $this->client->structured($model, $schemaName, $schema, $system, $user."\n\nReturn valid JSON matching the schema.");
        }
    }

    private function modelFor(string $role): string
    {
        return match ($role) {
            'fast' => (string) config('academy_ai.openai.fast_model'),
            'validation' => (string) config('academy_ai.openai.validation_model'),
            'image' => (string) config('academy_ai.openai.image_model'),
            default => (string) config('academy_ai.openai.reasoning_model'),
        };
    }
}

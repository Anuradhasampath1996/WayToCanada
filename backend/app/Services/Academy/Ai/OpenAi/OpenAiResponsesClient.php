<?php

namespace App\Services\Academy\Ai\OpenAi;

use App\Services\Academy\Ai\Dto\ImageGenerationResult;
use App\Services\Academy\Ai\Dto\StructuredGeneration;
use App\Services\Academy\Ai\Exceptions\AcademyAiException;
use App\Services\Academy\Ai\Exceptions\AcademyAiProviderDisabled;
use App\Services\Academy\Ai\Exceptions\AcademyAiRateLimited;
use App\Services\Academy\Ai\Exceptions\AcademyAiTimeout;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class OpenAiResponsesClient
{
    public function key(): string
    {
        return (string) config('academy_ai.openai.key');
    }

    public function configured(): bool
    {
        $key = $this->key();

        return $key !== '' && ! str_starts_with($key, 'sk-test');
    }

    /**
     * @param  array<string, mixed>  $schema
     */
    public function structured(string $model, string $schemaName, array $schema, string $instructions, string $input): StructuredGeneration
    {
        if (! $this->configured()) {
            throw new AcademyAiProviderDisabled('OpenAI is not configured for Academy AI.');
        }

        $payload = [
            'model' => $model,
            'instructions' => $instructions,
            'input' => $input,
            'text' => [
                'format' => [
                    'type' => 'json_schema',
                    'name' => $schemaName,
                    'strict' => true,
                    'schema' => $schema,
                ],
            ],
        ];

        $response = $this->post('/responses', $payload);
        $json = $response->json() ?? [];
        $text = $this->extractOutputText($json);
        $data = json_decode($text, true);
        if (! is_array($data)) {
            throw new AcademyAiException('OpenAI Responses output was not valid JSON.');
        }

        return new StructuredGeneration(
            data: $data,
            provider: 'openai',
            model: $model,
            usage: is_array($json['usage'] ?? null) ? $json['usage'] : [],
            requestId: $json['id'] ?? $response->header('x-request-id'),
        );
    }

    public function image(string $model, string $prompt, string $size = '1024x1024'): ImageGenerationResult
    {
        if (! $this->configured()) {
            throw new AcademyAiProviderDisabled('OpenAI is not configured for Academy AI.');
        }

        $response = $this->post('/images/generations', [
            'model' => $model,
            'prompt' => $prompt,
            'n' => 1,
            'size' => $size,
        ]);
        $json = $response->json() ?? [];
        $row = $json['data'][0] ?? [];
        $binary = '';
        if (! empty($row['b64_json'])) {
            $binary = (string) base64_decode((string) $row['b64_json'], true);
        } elseif (! empty($row['url'])) {
            $binary = (string) Http::timeout(60)->get((string) $row['url'])->body();
        }
        if ($binary === '') {
            throw new AcademyAiException('OpenAI image generation returned no image data.');
        }

        return new ImageGenerationResult(
            binary: $binary,
            provider: 'openai',
            model: $model,
            prompt: $prompt,
            requestId: $json['id'] ?? $response->header('x-request-id'),
        );
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function post(string $path, array $payload): Response
    {
        $url = rtrim((string) config('academy_ai.openai.base_url'), '/').$path;
        try {
            $response = Http::withToken($this->key())
                ->acceptJson()
                ->timeout((int) config('academy_ai.openai.timeout', 120))
                ->post($url, $payload);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new AcademyAiTimeout($e->getMessage(), 0, $e);
        }

        if ($response->status() === 429) {
            throw new AcademyAiRateLimited('OpenAI rate limited Academy AI request.');
        }
        if ($response->failed()) {
            throw new AcademyAiException('OpenAI request failed with HTTP '.$response->status().'.');
        }

        return $response;
    }

    /** @param array<string, mixed> $json */
    public function extractOutputText(array $json): string
    {
        if (is_string($json['output_text'] ?? null) && $json['output_text'] !== '') {
            return $json['output_text'];
        }

        foreach ($json['output'] ?? [] as $item) {
            if (($item['type'] ?? '') === 'refusal') {
                throw new AcademyAiException('OpenAI refused the Academy structured request.');
            }
            foreach ($item['content'] ?? [] as $content) {
                if (is_string($content['text'] ?? null) && $content['text'] !== '') {
                    return $content['text'];
                }
                if (is_array($content['parsed'] ?? null)) {
                    return json_encode($content['parsed']) ?: '';
                }
            }
        }

        return '';
    }
}

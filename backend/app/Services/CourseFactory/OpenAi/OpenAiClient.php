<?php

namespace App\Services\CourseFactory\OpenAi;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class OpenAiClient
{
    /**
     * Structured JSON generation via Chat Completions + json_schema.
     *
     * @return array{data: array, usage: array, model: string, raw: array}
     */
    public function structured(string $system, string $user, array $schema, string $schemaName = 'result', ?string $model = null): array
    {
        $model = $model ?: (string) config('course_factory.openai.reasoning_model');
        $payload = [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $user],
            ],
            'response_format' => [
                'type' => 'json_schema',
                'json_schema' => [
                    'name' => $schemaName,
                    'strict' => true,
                    'schema' => $this->enforceStrictSchema($schema),
                ],
            ],
            'temperature' => 0.2,
        ];

        $json = $this->post('/chat/completions', $payload);
        $content = $json['choices'][0]['message']['content'] ?? null;
        if (! is_string($content) || $content === '') {
            throw new RuntimeException('OpenAI returned empty structured content.');
        }

        $data = json_decode($content, true);
        if (! is_array($data)) {
            throw new RuntimeException('OpenAI structured output was not valid JSON.');
        }

        return [
            'data' => $data,
            'usage' => $json['usage'] ?? [],
            'model' => $model,
            'raw' => $json,
        ];
    }

    public function text(string $system, string $user, ?string $model = null): array
    {
        $model = $model ?: (string) config('course_factory.openai.text_model');
        $json = $this->post('/chat/completions', [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $user],
            ],
            'temperature' => 0.4,
        ]);

        return [
            'text' => (string) ($json['choices'][0]['message']['content'] ?? ''),
            'usage' => $json['usage'] ?? [],
            'model' => $model,
            'raw' => $json,
        ];
    }

    /**
     * @return array{b64_json?: string, url?: string, model: string}
     */
    public function generateImage(string $prompt, string $size = '1536x1024'): array
    {
        $model = (string) config('course_factory.openai.image_model', 'gpt-image-1');
        $json = $this->post('/images/generations', [
            'model' => $model,
            'prompt' => $prompt,
            'size' => $size,
            'n' => 1,
        ]);

        $item = $json['data'][0] ?? [];

        return [
            'b64_json' => $item['b64_json'] ?? null,
            'url' => $item['url'] ?? null,
            'model' => $model,
        ];
    }

    private function post(string $path, array $payload): array
    {
        $key = (string) config('course_factory.openai.key', config('services.openai.key', ''));
        if ($key === '') {
            throw new RuntimeException('OPENAI_API_KEY is not configured.');
        }

        $base = (string) config('course_factory.openai.base_url', 'https://api.openai.com/v1');
        $timeout = (int) config('course_factory.openai.timeout', 180);

        $response = Http::baseUrl($base)
            ->withToken($key)
            ->timeout($timeout)
            ->acceptJson()
            ->asJson()
            ->post($path, $payload);

        $json = $response->json() ?? [];
        if (! $response->successful()) {
            $msg = $json['error']['message'] ?? $response->body();
            throw new RuntimeException('OpenAI request failed: '.$msg);
        }

        return $json;
    }

    private function enforceStrictSchema(array $schema): array
    {
        $schema['additionalProperties'] = false;
        if (($schema['type'] ?? null) === 'object' && isset($schema['properties']) && is_array($schema['properties'])) {
            $schema['required'] = array_values(array_keys($schema['properties']));
            foreach ($schema['properties'] as $key => $prop) {
                if (is_array($prop)) {
                    $schema['properties'][$key] = $this->enforceStrictSchema($prop);
                }
            }
        }
        if (($schema['type'] ?? null) === 'array' && isset($schema['items']) && is_array($schema['items'])) {
            $schema['items'] = $this->enforceStrictSchema($schema['items']);
        }

        return $schema;
    }
}

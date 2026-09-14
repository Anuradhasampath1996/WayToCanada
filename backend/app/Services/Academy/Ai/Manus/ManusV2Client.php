<?php

namespace App\Services\Academy\Ai\Manus;

use App\Services\Academy\Ai\Exceptions\AcademyAiException;
use App\Services\Academy\Ai\Exceptions\AcademyAiProviderDisabled;
use App\Services\Academy\Ai\Exceptions\AcademyAiRateLimited;
use App\Services\Academy\Ai\Exceptions\AcademyAiTimeout;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Official Manus API v2 only.
 * Docs: https://open.manus.ai/docs/v2/introduction
 * Base: https://api.manus.ai
 */
class ManusV2Client
{
    public function configured(): bool
    {
        return (bool) config('academy_ai.manus.enabled')
            && filled(config('academy_ai.manus.api_key'));
    }

    /**
     * POST /v2/task.create
     *
     * @param  array<string, mixed>  $schema
     * @return array<string, mixed>
     */
    public function createTask(string $message, array $schema, string $title = 'RCIC Academy research'): array
    {
        $this->assertConfigured();

        $response = $this->request('POST', '/v2/task.create', [
            'message' => ['content' => $message],
            'structured_output_schema' => $schema,
            'agent_profile' => config('academy_ai.manus.agent_profile', 'standard'),
            'hide_in_task_list' => true,
            'interactive_mode' => false,
            'task_title' => $title,
        ]);

        return $response->json() ?? [];
    }

    /**
     * GET /v2/task.detail?task_id=
     *
     * @return array<string, mixed>
     */
    public function taskDetail(string $taskId): array
    {
        $this->assertConfigured();

        return $this->request('GET', '/v2/task.detail', [], ['task_id' => $taskId])->json() ?? [];
    }

    /**
     * GET /v2/task.listMessages?task_id=
     *
     * @return array<string, mixed>
     */
    public function listMessages(string $taskId, int $limit = 20): array
    {
        $this->assertConfigured();

        return $this->request('GET', '/v2/task.listMessages', [], [
            'task_id' => $taskId,
            'order' => 'desc',
            'limit' => $limit,
        ])->json() ?? [];
    }

    /**
     * GET /v2/webhook.publicKey
     */
    public function webhookPublicKey(): string
    {
        $this->assertConfigured();
        $json = $this->request('GET', '/v2/webhook.publicKey')->json() ?? [];

        return (string) ($json['public_key'] ?? '');
    }

    public function extractStructuredResult(array $listMessages): ?array
    {
        $messages = $listMessages['messages'] ?? $listMessages['data'] ?? [];
        if (! is_array($messages)) {
            return null;
        }
        foreach ($messages as $message) {
            if (($message['type'] ?? '') === 'structured_output_result') {
                $result = $message['structured_output_result'] ?? $message;
                if (is_array($result['value'] ?? null)) {
                    return $result;
                }
            }
            if (is_array($message['structured_output_result']['value'] ?? null)) {
                return $message['structured_output_result'];
            }
        }

        return null;
    }

    private function assertConfigured(): void
    {
        if (! $this->configured()) {
            throw new AcademyAiProviderDisabled('Manus Academy research is not configured.');
        }
    }

    /**
     * @param  array<string, mixed>  $body
     * @param  array<string, mixed>  $query
     */
    private function request(string $method, string $path, array $body = [], array $query = []): Response
    {
        $url = rtrim((string) config('academy_ai.manus.base_url'), '/').$path;
        try {
            $pending = Http::withHeaders([
                'x-manus-api-key' => (string) config('academy_ai.manus.api_key'),
                'Accept' => 'application/json',
            ])->timeout((int) config('academy_ai.openai.timeout', 120));

            $response = $method === 'GET'
                ? $pending->get($url, $query)
                : $pending->post($url, $body);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new AcademyAiTimeout($e->getMessage(), 0, $e);
        }

        if ($response->status() === 429) {
            throw new AcademyAiRateLimited('Manus rate limited Academy research.');
        }
        if ($response->failed()) {
            throw new AcademyAiException('Manus API v2 request failed with HTTP '.$response->status().'.');
        }

        $json = $response->json();
        if (is_array($json) && array_key_exists('ok', $json) && $json['ok'] === false) {
            $code = $json['error']['code'] ?? 'error';
            if ($code === 'rate_limited') {
                throw new AcademyAiRateLimited((string) ($json['error']['message'] ?? 'Manus rate limited.'));
            }
            throw new AcademyAiException((string) ($json['error']['message'] ?? 'Manus API v2 error.'));
        }

        return $response;
    }
}

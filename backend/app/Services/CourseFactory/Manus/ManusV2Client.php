<?php

namespace App\Services\CourseFactory\Manus;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Manus API v2 client — async tasks only (task.create + listMessages / webhooks).
 * @see https://open.manus.ai/docs/v2/task.create
 */
class ManusV2Client
{
    public function createTask(
        string $prompt,
        ?array $structuredOutputSchema = null,
        ?string $title = null,
        bool $interactiveMode = false,
    ): array {
        $payload = [
            'message' => [
                'content' => [
                    ['type' => 'text', 'text' => $prompt],
                ],
            ],
            'agent_profile' => (string) config('course_factory.manus.agent_profile', 'standard'),
            'interactive_mode' => $interactiveMode,
            'hide_in_task_list' => true,
            'share_visibility' => 'private',
        ];

        if ($title) {
            $payload['task_title'] = $title;
        }

        if ($structuredOutputSchema) {
            $payload['structured_output_schema'] = $structuredOutputSchema;
        }

        $response = $this->http()->post('/v2/task.create', $payload);
        $json = $response->json() ?? [];

        if (! $response->successful() || empty($json['ok'])) {
            $msg = $json['error']['message'] ?? $response->body();
            throw new RuntimeException('Manus task.create failed: '.$msg);
        }

        return $json;
    }

    public function listMessages(string $taskId, ?string $after = null, int $limit = 50): array
    {
        $query = ['task_id' => $taskId, 'limit' => $limit];
        if ($after) {
            $query['after'] = $after;
        }

        $response = $this->http()->get('/v2/task.listMessages', $query);
        $json = $response->json() ?? [];

        if (! $response->successful() || empty($json['ok'])) {
            $msg = $json['error']['message'] ?? $response->body();
            throw new RuntimeException('Manus task.listMessages failed: '.$msg);
        }

        return $json;
    }

    public function sendMessage(string $taskId, string $text): array
    {
        $response = $this->http()->post('/v2/task.sendMessage', [
            'task_id' => $taskId,
            'message' => [
                'content' => [
                    ['type' => 'text', 'text' => $text],
                ],
            ],
        ]);

        $json = $response->json() ?? [];
        if (! $response->successful() || empty($json['ok'])) {
            $msg = $json['error']['message'] ?? $response->body();
            throw new RuntimeException('Manus task.sendMessage failed: '.$msg);
        }

        return $json;
    }

    public function webhookPublicKey(): string
    {
        $response = $this->http()->get('/v2/webhook.publicKey');
        $json = $response->json() ?? [];
        if (! $response->successful() || empty($json['ok'])) {
            $msg = $json['error']['message'] ?? $response->body();
            throw new RuntimeException('Manus webhook.publicKey failed: '.$msg);
        }

        return (string) ($json['public_key'] ?? '');
    }

    public function createWebhook(string $url): array
    {
        $response = $this->http()->post('/v2/webhook.create', ['url' => $url]);
        $json = $response->json() ?? [];
        if (! $response->successful() || empty($json['ok'])) {
            $msg = $json['error']['message'] ?? $response->body();
            throw new RuntimeException('Manus webhook.create failed: '.$msg);
        }

        return $json;
    }

    private function http(): PendingRequest
    {
        $key = (string) config('course_factory.manus.api_key', '');
        if ($key === '') {
            throw new RuntimeException('MANUS_API_KEY is not configured.');
        }

        $base = (string) config('course_factory.manus.base_url', 'https://api.manus.ai');

        return Http::baseUrl($base)
            ->timeout(60)
            ->acceptJson()
            ->asJson()
            ->withHeaders(['x-manus-api-key' => $key]);
    }
}

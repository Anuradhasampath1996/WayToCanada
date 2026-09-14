<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Jobs\RunAcademyAiGenerationJob;
use App\Models\Academy\AcademyAiGenerationStep;
use App\Models\Academy\AcademyAiManusEvent;
use App\Services\Academy\Ai\Manus\ManusV2Client;
use App\Services\Academy\Ai\Manus\ManusWebhookVerifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ManusAcademyWebhookController extends Controller
{
    public function handle(Request $request, ManusWebhookVerifier $verifier, ManusV2Client $client)
    {
        $raw = $request->getContent();
        $signature = (string) $request->header('X-Webhook-Signature', '');
        $timestamp = (string) $request->header('X-Webhook-Timestamp', '');
        if ($signature === '' || $timestamp === '') {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $url = (string) (config('academy_ai.manus.webhook_url') ?: $request->fullUrl());
        $publicKey = Cache::remember('academy_ai.manus_webhook_public_key', 3600, fn () => $client->webhookPublicKey());
        if (! $verifier->verify($publicKey, $url, $raw, $signature, $timestamp)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $payload = json_decode($raw, true) ?: [];
        $taskId = (string) ($payload['task_id'] ?? $payload['task']['task_id'] ?? '');
        $eventKey = (string) ($payload['event_id'] ?? $payload['request_id'] ?? hash('sha256', $raw));
        $existing = AcademyAiManusEvent::query()->where('event_key', $eventKey)->first();
        if ($existing) {
            return response()->json(['ok' => true, 'duplicate' => true]);
        }

        AcademyAiManusEvent::query()->create([
            'event_key' => $eventKey,
            'task_id' => $taskId ?: null,
            'request_id' => $payload['request_id'] ?? null,
            'status' => $payload['status'] ?? $payload['event_type'] ?? null,
            'payload_json' => $payload,
            'processed_at' => now(),
        ]);

        if ($taskId !== '') {
            $step = AcademyAiGenerationStep::query()->where('manus_task_id', $taskId)->first();
            if ($step) {
                $step->update([
                    'output_ref_json' => array_merge($step->output_ref_json ?? [], ['webhook' => $payload]),
                ]);
                RunAcademyAiGenerationJob::dispatch($step->generation_job_id);
            }
        }

        return response()->json(['ok' => true]);
    }
}

<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Jobs\CourseFactory\PollManusCourseFactoryJob;
use App\Models\CourseFactory\CfGenerationStep;
use App\Services\CourseFactory\Manus\ManusWebhookVerifier;
use App\Services\CourseFactory\Pipeline\GenerationEventWriter;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class ManusCourseFactoryWebhookController extends Controller
{
    public function handle(Request $request, ManusWebhookVerifier $verifier, GenerationEventWriter $events): Response
    {
        $raw = $request->getContent();
        $signature = (string) $request->header('X-Webhook-Signature', '');
        $timestamp = (string) $request->header('X-Webhook-Timestamp', '');

        // Manus may send a connectivity probe before activation.
        if ($raw === '' || $request->header('X-Manus-Webhook-Test')) {
            return response('OK', 200);
        }

        $url = $request->fullUrl();
        if ($signature !== '' && $timestamp !== '') {
            if (! $verifier->verify($raw, $signature, $timestamp, $url)) {
                Log::warning('Manus course-factory webhook signature failed');

                return response('Unauthorized', 401);
            }
        }

        $payload = $request->json()->all();
        $taskId = $payload['task_detail']['task_id']
            ?? $payload['task_id']
            ?? null;

        if (is_string($taskId) && $taskId !== '') {
            $step = CfGenerationStep::query()
                ->where('external_task_id', $taskId)
                ->where('status', 'waiting_external')
                ->latest('id')
                ->first();

            if ($step) {
                PollManusCourseFactoryJob::dispatch($step->generation_run_id, $step->id);
            }
        }

        return response('OK', 200);
    }
}

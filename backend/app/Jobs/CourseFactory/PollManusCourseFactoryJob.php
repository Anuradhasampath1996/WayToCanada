<?php

namespace App\Jobs\CourseFactory;

use App\Models\CourseFactory\CfContentValidation;
use App\Models\CourseFactory\CfGenerationRun;
use App\Models\CourseFactory\CfGenerationStep;
use App\Models\Lms\LmsQuestionBank;
use App\Services\CourseFactory\Manus\ManusV2Client;
use App\Services\CourseFactory\Pipeline\CourseFactoryOrchestrator;
use App\Services\CourseFactory\Pipeline\GenerationEventWriter;
use App\Services\CourseFactory\Pipeline\StageProcessor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PollManusCourseFactoryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 120;

    public function __construct(public int $runId, public int $stepId) {}

    public function handle(
        ManusV2Client $manus,
        StageProcessor $stages,
        CourseFactoryOrchestrator $orchestrator,
        GenerationEventWriter $events,
    ): void {
        try {
            app(\App\Services\IntegrationSettingsService::class)->applyRuntimeConfig();
        } catch (\Throwable) {
            // ignore
        }

        $run = CfGenerationRun::query()->find($this->runId);
        $step = CfGenerationStep::query()->find($this->stepId);
        if (! $run || ! $step || $run->status === 'cancelled') {
            return;
        }
        if ($step->status !== 'waiting_external' || ! $step->external_task_id) {
            AdvanceCourseFactoryJob::dispatch($run->id);

            return;
        }

        try {
            $this->poll($manus, $stages, $events, $run, $step);
        } catch (\Throwable $e) {
            $max = (int) config('course_factory.max_retries', 3);
            $retry = (int) $step->retry_count + 1;
            $step->update([
                'retry_count' => $retry,
                'error_message' => $e->getMessage(),
                'error_code' => class_basename($e),
                'status' => $retry <= $max ? 'retrying' : 'failed',
            ]);
            $events->write($run, $step->step_key.'_failed', $step->step_name.' failed', $e->getMessage(), 'Manus', ['retry' => $retry], 'error');
            if ($retry <= $max) {
                AdvanceCourseFactoryJob::dispatch($run->id)->delay(now()->addSeconds(min(60, 5 * $retry)));
            } else {
                $run->update(['status' => 'failed', 'failed_at' => now(), 'error_summary' => $e->getMessage()]);
            }
        }
    }

    private function poll(
        ManusV2Client $manus,
        StageProcessor $stages,
        GenerationEventWriter $events,
        CfGenerationRun $run,
        CfGenerationStep $step,
    ): void {
        $messages = $manus->listMessages($step->external_task_id, null, 30);
        $items = $messages['messages'] ?? $messages['data'] ?? $messages['items'] ?? [];
        if (! is_array($items)) {
            $items = [];
        }

        $agentStatus = null;
        $structured = null;
        $error = null;
        $activity = null;

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $type = $item['type'] ?? null;
            if ($type === 'status_update') {
                $agentStatus = $item['status_update']['agent_status'] ?? $item['agent_status'] ?? $agentStatus;
                if (($item['status_update']['agent_status'] ?? null) === 'error') {
                    $error = $item['status_update']['error_message'] ?? 'Manus task error';
                }
            }
            if (isset($item['structured_output_result']) && is_array($item['structured_output_result'])) {
                $structured = $item['structured_output_result'];
            }
            if ($type === 'assistant_message') {
                $content = $item['assistant_message']['content'] ?? null;
                if (is_string($content) && $content !== '') {
                    $activity = mb_substr($content, 0, 280);
                }
                if (isset($item['assistant_message']['structured_output_result']) && is_array($item['assistant_message']['structured_output_result'])) {
                    $structured = $item['assistant_message']['structured_output_result'];
                }
            }
            if (isset($item['structured_output']) && is_array($item['structured_output'])) {
                $structured = $item['structured_output'];
            }
        }

        if (! $structured && isset($messages['structured_output_result']) && is_array($messages['structured_output_result'])) {
            $structured = $messages['structured_output_result'];
        }

        if ($activity) {
            $events->write($run, 'manus_activity', 'Manus activity', $activity, 'Manus');
        }

        if ($agentStatus === 'waiting') {
            try {
                $manus->sendMessage($step->external_task_id, 'Please continue using only public authoritative sources. Do not ask clarifying questions; mark unknowns as unknown.');
            } catch (\Throwable) {
                // ignore
            }
            self::dispatch($run->id, $step->id)->delay(now()->addSeconds((int) config('course_factory.manus.poll_seconds', 8)));

            return;
        }

        if ($agentStatus === 'error') {
            throw new \RuntimeException($error ?: 'Manus task failed');
        }

        if ($agentStatus === 'stopped' || $structured) {
            $this->applyStructuredResult($run, $step, $stages, $structured ?? []);
            AdvanceCourseFactoryJob::dispatch($run->id);

            return;
        }

        $elapsed = $step->started_at ? $step->started_at->diffInSeconds(now()) : 0;
        if ($elapsed > (int) config('course_factory.manus.timeout_seconds', 900)) {
            throw new \RuntimeException('Manus task timed out.');
        }

        self::dispatch($run->id, $step->id)->delay(now()->addSeconds((int) config('course_factory.manus.poll_seconds', 8)));
    }

    private function applyStructuredResult(
        CfGenerationRun $run,
        CfGenerationStep $step,
        StageProcessor $stages,
        array $structured,
    ): void {
        if ($step->step_key === 'manus_deep_research') {
            $stages->completeManusResearch($run, $step, $structured);

            return;
        }

        if ($step->step_key === 'research_verification') {
            $structured = $stages->unwrapStructuredPayload($structured);
            $merged = array_replace_recursive(
                $stages->unwrapStructuredPayload($run->research_json ?? []),
                $structured
            );
            $run->update(['research_json' => $merged]);
            $step->update([
                'status' => 'completed',
                'progress' => 100,
                'completed_at' => now(),
                'metadata' => array_merge($step->metadata ?? [], ['followup_done' => true]),
            ]);

            return;
        }

        if ($step->step_key === 'manus_factual_validation') {
            $batchIds = collect($step->metadata['batch_ids'] ?? [])->map(fn ($id) => (int) $id)->all();
            $checkedIds = collect($step->metadata['checked_ids'] ?? [])->map(fn ($id) => (int) $id)->all();
            $targetSample = (int) ($step->metadata['target_sample'] ?? 12);

            foreach ($structured['results'] ?? [] as $row) {
                if (! is_array($row) || empty($row['id'])) {
                    continue;
                }
                CfContentValidation::query()->create([
                    'generation_run_id' => $run->id,
                    'target_type' => 'question_factual',
                    'target_id' => (int) $row['id'],
                    'validator' => 'manus',
                    'status' => ($row['passed'] ?? false) ? 'passed' : 'failed',
                    'result_json' => $row,
                ]);
                if (! ($row['passed'] ?? false)) {
                    LmsQuestionBank::query()->where('id', (int) $row['id'])->update([
                        'verification_status' => 'factual_failed',
                        'status' => 'draft',
                    ]);
                }
                $checkedIds[] = (int) $row['id'];
            }

            // Ensure batch ids are marked checked even if Manus omitted one.
            $checkedIds = array_values(array_unique(array_merge($checkedIds, $batchIds)));
            $done = count($checkedIds) >= $targetSample;

            $step->update([
                'status' => $done ? 'completed' : 'pending',
                'progress' => $done ? 100 : (int) min(95, floor((count($checkedIds) / max(1, $targetSample)) * 100)),
                'completed_at' => $done ? now() : null,
                'external_task_id' => null,
                'metadata' => [
                    'done' => $done,
                    'checked_ids' => $checkedIds,
                    'target_sample' => $targetSample,
                    'last_batch_ids' => $batchIds,
                ],
            ]);

            return;
        }
    }
}

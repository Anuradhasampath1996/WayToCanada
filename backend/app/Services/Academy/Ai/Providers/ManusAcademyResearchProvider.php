<?php

namespace App\Services\Academy\Ai\Providers;

use App\Models\Academy\AcademyAiGenerationJob;
use App\Models\Academy\AcademyAiGenerationStep;
use App\Services\Academy\Ai\AcademyAiPromptCatalog;
use App\Services\Academy\Ai\AcademyAiSchemas;
use App\Services\Academy\Ai\AcademyAiUsageService;
use App\Services\Academy\Ai\Contracts\AcademyResearchProvider;
use App\Services\Academy\Ai\Dto\ResearchNotes;
use App\Services\Academy\Ai\Exceptions\AcademyAiException;
use App\Services\Academy\Ai\Exceptions\AcademyAiProviderDisabled;
use App\Services\Academy\Ai\Exceptions\AcademyAiTimeout;
use App\Services\Academy\Ai\Manus\ManusV2Client;

class ManusAcademyResearchProvider implements AcademyResearchProvider
{
    public function __construct(
        private ManusV2Client $client,
        private AcademyAiUsageService $usage,
    ) {}

    public function configured(): bool
    {
        return $this->client->configured();
    }

    public function name(): string
    {
        return 'manus';
    }

    public function research(AcademyAiGenerationJob $job, array $task): ResearchNotes
    {
        if (! $this->configured()) {
            throw new AcademyAiProviderDisabled('Manus research is disabled or missing MANUS_API_KEY.');
        }

        $created = $this->client->createTask(
            (string) ($task['prompt'] ?? 'Research official Canadian immigration sources for RCIC exam-prep drafting. Return candidate official URLs only.'),
            AcademyAiSchemas::researchNotes(),
            'Academy research job '.$job->id,
        );

        $taskId = (string) ($created['task_id'] ?? '');
        $requestId = (string) ($created['request_id'] ?? '');
        if ($taskId === '') {
            throw new AcademyAiException('Manus task.create did not return task_id.');
        }

        AcademyAiGenerationStep::query()->create([
            'generation_job_id' => $job->id,
            'stage' => 'manus_task',
            'status' => 'running',
            'provider' => 'manus',
            'manus_task_id' => $taskId,
            'manus_request_id' => $requestId,
            'output_ref_json' => ['create' => $created],
            'started_at' => now(),
        ]);

        $this->usage->record(
            jobId: $job->id,
            provider: 'manus',
            operation: 'research_task.create',
            model: (string) config('academy_ai.manus.agent_profile'),
            requestId: $requestId,
            taskId: $taskId,
            estimatedCost: null,
            costEstimated: true,
            extra: ['note' => 'Manus cost not fabricated; API did not return a dollar amount.'],
        );

        $deadline = time() + (int) config('academy_ai.manus.timeout_seconds', 180);
        $status = 'running';
        while (time() <= $deadline) {
            $detail = $this->client->taskDetail($taskId);
            $status = (string) ($detail['task']['status'] ?? $detail['status'] ?? 'running');
            if (in_array($status, ['stopped', 'error'], true)) {
                break;
            }
            if ($status === 'waiting') {
                throw new AcademyAiException('Manus task is waiting for input; interactive research is not used for Academy.');
            }
            $wait = max(0, (int) config('academy_ai.manus.poll_seconds', 5));
            if ($wait > 0) {
                usleep($wait * 200_000);
            }
        }

        if ($status === 'running') {
            throw new AcademyAiTimeout('Manus research task timed out.');
        }
        if ($status === 'error') {
            throw new AcademyAiException('Manus research task failed.');
        }

        $messages = $this->client->listMessages($taskId);
        $structured = $this->client->extractStructuredResult($messages);
        if (! is_array($structured['value'] ?? null)) {
            throw new AcademyAiException('Manus structured_output_result was missing.');
        }

        $notes = ResearchNotes::fromArray($structured['value'], 'manus');
        $notes->providerTaskId = $taskId;
        $notes->providerRequestId = $requestId;
        $notes->raw = ['create' => $created, 'messages' => $messages, 'structured' => $structured];

        return $notes;
    }
}

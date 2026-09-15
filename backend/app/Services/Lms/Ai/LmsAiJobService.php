<?php

namespace App\Services\Lms\Ai;

use App\Jobs\RunLmsAiGenerationJob;
use App\Models\Lms\LmsAiGenerationJob;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class LmsAiJobService
{
    public function __construct(
        private LmsAiOrchestrator $orchestrator,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, User $actor): LmsAiGenerationJob
    {
        if (! config('academy_ai.enabled', true)) {
            throw ValidationException::withMessages(['lms_ai' => 'Learning AI is disabled.']);
        }

        $profile = (string) ($data['generation_profile'] ?? '');
        $meta = config('learning.generation_profiles.'.$profile, []);
        if (($meta['product_domain'] ?? null) !== 'client_lms') {
            throw ValidationException::withMessages(['generation_profile' => 'This generation profile cannot target Client LMS.']);
        }

        $usesCases = (bool) ($meta['uses_cases'] ?? false);
        $independent = (int) ($data['independent_count'] ?? 10);
        $caseBased = $usesCases ? (int) ($data['case_based_count'] ?? 0) : 0;
        $caseCount = $usesCases ? (int) ($data['case_count'] ?? 0) : 0;
        $payload = array_merge($data, [
            'independent_count' => $independent,
            'case_based_count' => $caseBased,
            'case_count' => $caseCount,
            'generate_cases' => $usesCases && ($data['generate_cases'] ?? false),
            'generate_case_mcqs' => $usesCases && ($data['generate_case_mcqs'] ?? false),
            'generate_lessons' => $data['generate_lessons'] ?? true,
            'generate_independent_mcqs' => $data['generate_independent_mcqs'] ?? true,
            'include_mock' => $data['include_mock'] ?? true,
            'module_count' => (int) ($data['module_count'] ?? 1),
            'lesson_count' => (int) ($data['lesson_count'] ?? 2),
            'mock_question_count' => (int) ($data['mock_question_count'] ?? $independent),
        ]);

        $job = LmsAiGenerationJob::query()->create([
            'type' => $data['type'] ?? 'course',
            'status' => 'queued',
            'requested_by' => $actor->id,
            'exam_id' => $data['exam_id'] ?? null,
            'course_id' => $data['course_id'] ?? null,
            'evidence_pack_id' => $data['evidence_pack_id'] ?? null,
            'generation_profile' => $profile,
            'product_domain' => 'client_lms',
            'content_language' => $data['content_language'] ?? 'en',
            'title' => $data['title'] ?? 'LMS AI draft',
            'goal' => $data['goal'] ?? null,
            'request_json' => $payload,
            'blueprint_approved' => ($data['type'] ?? 'course') !== 'course',
            'progress_json' => ['modules' => '0/0', 'lessons' => '0/0', 'questions' => '0/0', 'validation' => '0/0'],
        ]);

        RunLmsAiGenerationJob::dispatch($job->id);

        return $job->fresh();
    }

    public function approveBlueprint(LmsAiGenerationJob $job): LmsAiGenerationJob
    {
        $job->update([
            'blueprint_approved' => true,
            'status' => 'queued',
            'error' => null,
        ]);
        RunLmsAiGenerationJob::dispatch($job->id);

        return $job->fresh();
    }

    public function retry(LmsAiGenerationJob $job): LmsAiGenerationJob
    {
        $job->update(['status' => 'queued', 'error' => null]);
        RunLmsAiGenerationJob::dispatch($job->id);

        return $job->fresh();
    }

    public function process(int $jobId): void
    {
        $this->orchestrator->run(LmsAiGenerationJob::query()->findOrFail($jobId));
    }

    public function publishDenied(): never
    {
        LmsAiGuard::denyPublish();
    }
}

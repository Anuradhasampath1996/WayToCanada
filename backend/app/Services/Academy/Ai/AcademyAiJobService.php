<?php

namespace App\Services\Academy\Ai;

use App\Jobs\RunAcademyAiGenerationJob;
use App\Models\Academy\AcademyAiGenerationJob;
use App\Models\Academy\AcademyAiSourcePack;
use App\Models\Academy\AcademyAiSourcePackItem;
use App\Models\User;
use App\Services\Academy\Ai\Exceptions\AcademyAiException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AcademyAiJobService
{
    public function __construct(
        private AcademyAiSettingsService $settings,
        private AcademyAiOrchestrator $orchestrator,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, User $actor): AcademyAiGenerationJob
    {
        if (! config('academy_ai.enabled')) {
            throw ValidationException::withMessages(['academy_ai' => 'Academy AI is disabled.']);
        }
        $this->settings->assertBudget();

        $independent = (int) ($data['independent_count'] ?? 0);
        $caseBased = (int) ($data['case_based_count'] ?? 0);
        if ($independent + $caseBased > $this->settings->maxQuestions()) {
            throw ValidationException::withMessages(['independent_count' => 'Question count exceeds max per job.']);
        }

        $job = AcademyAiGenerationJob::query()->create([
            'type' => $data['type'] ?? 'course',
            'status' => 'queued',
            'requested_by' => $actor->id,
            'track_id' => $data['track_id'] ?? null,
            'exam_template_id' => $data['exam_template_id'] ?? null,
            'exam_id' => $data['exam_id'] ?? null,
            'evidence_pack_id' => $data['evidence_pack_id'] ?? null,
            'generation_profile' => $data['generation_profile'] ?? null,
            'title' => $data['title'] ?? 'Academy AI draft',
            'goal' => $data['goal'] ?? null,
            'difficulty' => $data['difficulty'] ?? 'intermediate',
            'estimated_hours' => $data['estimated_hours'] ?? null,
            'request_json' => $data,
            'blueprint_approved' => ($data['type'] ?? 'course') !== 'course',
            'progress_json' => ['modules' => '0/0', 'lessons' => '0/0', 'questions' => '0/0', 'validation' => '0/0'],
        ]);

        $pack = AcademyAiSourcePack::query()->create([
            'generation_job_id' => $job->id,
            'status' => 'ready',
        ]);
        foreach ($data['source_ids'] ?? [] as $sourceId) {
            AcademyAiSourcePackItem::query()->create([
                'source_pack_id' => $pack->id,
                'item_type' => 'academy_source',
                'legal_source_id' => $sourceId,
            ]);
        }
        foreach ($data['urls'] ?? [] as $url) {
            AcademyAiSourcePackItem::query()->create([
                'source_pack_id' => $pack->id,
                'item_type' => 'url',
                'url' => $url,
                'admin_trusted_host' => in_array($url, $data['trusted_urls'] ?? [], true),
            ]);
        }

        RunAcademyAiGenerationJob::dispatch($job->id);

        return $job->fresh(['sourcePack.items']);
    }

    public function attachUpload(AcademyAiGenerationJob $job, UploadedFile $file): AcademyAiSourcePackItem
    {
        $disk = config('academy.media_disk');
        $path = $file->store('ai-uploads/'.$job->id, $disk);
        $pack = $job->sourcePack ?: AcademyAiSourcePack::query()->create([
            'generation_job_id' => $job->id,
            'status' => 'ready',
        ]);

        return AcademyAiSourcePackItem::query()->create([
            'source_pack_id' => $pack->id,
            'item_type' => 'upload',
            'title' => $file->getClientOriginalName(),
            'storage_disk' => $disk,
            'storage_path' => $path,
        ]);
    }

    public function saveBlueprint(AcademyAiGenerationJob $job, array $blueprint): AcademyAiGenerationJob
    {
        if ($job->status !== 'blueprint' && ! $job->blueprint_json) {
            throw new AcademyAiException('Blueprint is not editable yet.');
        }
        $job->update(['blueprint_json' => $blueprint]);

        return $job->fresh();
    }

    public function approveBlueprint(AcademyAiGenerationJob $job): AcademyAiGenerationJob
    {
        $job->update([
            'blueprint_approved' => true,
            'status' => 'queued',
        ]);
        RunAcademyAiGenerationJob::dispatch($job->id);

        return $job->fresh();
    }

    public function retry(AcademyAiGenerationJob $job): AcademyAiGenerationJob
    {
        $job->update(['status' => 'queued', 'error' => null]);
        RunAcademyAiGenerationJob::dispatch($job->id);

        return $job->fresh();
    }

    public function cancel(AcademyAiGenerationJob $job): AcademyAiGenerationJob
    {
        $job->update(['cancel_requested' => 'yes', 'status' => 'cancelled', 'completed_at' => now()]);

        return $job->fresh();
    }

    public function process(int $jobId): void
    {
        $this->orchestrator->run(AcademyAiGenerationJob::query()->findOrFail($jobId));
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Academy\AcademyAiGeneratedItem;
use App\Models\Academy\AcademyAiGenerationJob;
use App\Models\Academy\AcademyAiMedia;
use App\Models\Academy\AcademyAiUsageRecord;
use App\Models\Academy\AcademyCourse;
use App\Models\Academy\AcademyCourseVersion;
use App\Models\Academy\AcademyLesson;
use App\Models\Academy\AcademyQuestion;
use App\Models\Academy\AcademyQuestionVersion;
use App\Services\Academy\AcademyWorkflow;
use App\Services\Academy\Ai\AcademyAiGuard;
use App\Services\Academy\Ai\AcademyAiJobService;
use App\Services\Academy\Ai\AcademyAiOrchestrator;
use App\Services\Academy\Ai\AcademyAiProviderFactory;
use App\Services\Academy\Ai\AcademyAiSettingsService;
use App\Services\Academy\Ai\AcademyAiValidationService;
use App\Services\Academy\Ai\Exceptions\AcademyAiBudgetExceeded;
use Illuminate\Http\Request;

class AdminAcademyAiController extends Controller
{
    public function __construct(
        private AcademyAiJobService $jobs,
        private AcademyAiSettingsService $settings,
        private AcademyAiProviderFactory $factory,
        private AcademyWorkflow $workflow,
    ) {}

    public function bootstrap()
    {
        return response()->json([
            'settings' => $this->redact($this->settings->current()),
            'queue_warning' => config('queue.default') === 'sync'
                ? 'QUEUE_CONNECTION=sync — large jobs may time out in the HTTP request.'
                : null,
        ]);
    }

    public function storeJob(Request $request)
    {
        $data = $request->validate([
            'type' => 'required|in:course,questions,cases,mock_pool,regenerate,images',
            'title' => 'nullable|string',
            'goal' => 'nullable|string',
            'track_id' => 'nullable|integer',
            'exam_template_id' => 'nullable|integer',
            'exam_id' => 'nullable|integer',
            'course_id' => 'nullable|integer',
            'evidence_pack_id' => 'nullable|integer',
            'generation_profile' => 'nullable|string',
            'difficulty' => 'nullable|string',
            'estimated_hours' => 'nullable|numeric',
            'source_ids' => 'nullable|array',
            'source_ids.*' => 'integer',
            'urls' => 'nullable|array',
            'urls.*' => 'string',
            'trusted_urls' => 'nullable|array',
            'independent_count' => 'nullable|integer|min:0',
            'case_based_count' => 'nullable|integer|min:0',
            'case_count' => 'nullable|integer|min:0',
            'difficulty_mix' => 'nullable|array',
            'topic_mix' => 'nullable|array',
            'generate_lessons' => 'sometimes|boolean',
            'generate_independent_mcqs' => 'sometimes|boolean',
            'generate_cases' => 'sometimes|boolean',
            'generate_case_mcqs' => 'sometimes|boolean',
            'generate_images' => 'sometimes|boolean',
            'generate_blueprint_only' => 'sometimes|boolean',
            'question_id' => 'nullable|integer',
        ]);

        try {
            $job = $this->jobs->create($data, $request->user());
        } catch (AcademyAiBudgetExceeded $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'job' => $this->presentJob($job),
            'estimated_cost_usd' => $this->settings->estimateUsd(
                (int) ($data['independent_count'] ?? 0) + (int) ($data['case_based_count'] ?? 0),
                (bool) ($data['generate_images'] ?? false)
            ),
            'queue_warning' => config('queue.default') === 'sync'
                ? 'QUEUE_CONNECTION=sync — generation may run inline.'
                : null,
        ], 201);
    }

    public function jobs()
    {
        return response()->json([
            'data' => AcademyAiGenerationJob::query()->latest()->limit(100)->get()->map(fn ($j) => $this->presentJob($j)),
        ]);
    }

    public function showJob(AcademyAiGenerationJob $job)
    {
        $job->load(['steps', 'items.validation', 'snapshots', 'sourcePack.items', 'media', 'usageRecords']);

        return response()->json(['job' => $this->presentJob($job, true)]);
    }

    public function uploadSource(Request $request, AcademyAiGenerationJob $job)
    {
        $request->validate(['file' => 'required|file|max:20480']);

        return response()->json(['item' => $this->jobs->attachUpload($job, $request->file('file'))], 201);
    }

    public function saveBlueprint(Request $request, AcademyAiGenerationJob $job)
    {
        $data = $request->validate(['blueprint' => 'required|array']);

        return response()->json(['job' => $this->presentJob($this->jobs->saveBlueprint($job, $data['blueprint']))]);
    }

    public function approveBlueprint(AcademyAiGenerationJob $job)
    {
        return response()->json(['job' => $this->presentJob($this->jobs->approveBlueprint($job))]);
    }

    public function retry(AcademyAiGenerationJob $job)
    {
        return response()->json(['job' => $this->presentJob($this->jobs->retry($job))]);
    }

    public function cancel(AcademyAiGenerationJob $job)
    {
        return response()->json(['job' => $this->presentJob($this->jobs->cancel($job))]);
    }

    public function reviewQueue()
    {
        $items = AcademyAiGeneratedItem::query()
            ->with(['validation', 'job'])
            ->whereIn('status', ['generated', 'draft_imported', 'likely_duplicate'])
            ->latest()
            ->limit(200)
            ->get();

        return response()->json(['data' => $items]);
    }

    public function sendToContentReview(Request $request, AcademyAiGeneratedItem $item)
    {
        $model = $this->resolveEntity($item);
        if (! $model) {
            return response()->json(['message' => 'Item has no imported draft yet.'], 422);
        }
        $this->workflow->transition($model, 'content_review', $request->user());

        return response()->json(['item' => $item->fresh(), 'status' => $model->status]);
    }

    public function rejectItem(AcademyAiGeneratedItem $item)
    {
        $item->update(['status' => 'rejected_import']);

        return response()->json(['item' => $item->fresh()]);
    }

    public function revalidate(AcademyAiGeneratedItem $item, AcademyAiValidationService $validation)
    {
        $result = $validation->validateItem($item->job, $item);

        return response()->json(['validation' => $result]);
    }

    public function regenerateItem(Request $request, AcademyAiGeneratedItem $item, AcademyAiOrchestrator $orchestrator)
    {
        if (! $item->entity_id || $item->entity_type !== AcademyQuestion::class) {
            return response()->json(['message' => 'Only imported questions can be regenerated in v1.'], 422);
        }
        $question = AcademyQuestion::query()->findOrFail($item->entity_id);
        $new = $orchestrator->regenerateQuestion($item->job, $request->user(), $question);

        return response()->json(['item' => $new]);
    }

    public function publishDenied()
    {
        try {
            AcademyAiGuard::denyPublish();
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function approveMedia(Request $request, AcademyAiMedia $media)
    {
        $media->update([
            'approval_status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);
        if ($media->kind === 'course_thumbnail' && $media->job->course_id) {
            AcademyCourse::query()->whereKey($media->job->course_id)->update([
                'thumbnail_url' => $media->storage_path,
            ]);
        }
        if ($media->kind === 'lesson' && $media->associated_type === AcademyLesson::class && $media->associated_id) {
            AcademyLesson::query()->whereKey($media->associated_id)->update([
                'media_url' => $media->storage_path,
                'media_disk' => $media->storage_disk,
            ]);
        }

        return response()->json(['media' => $media->fresh()]);
    }

    public function settings()
    {
        return response()->json($this->redact($this->settings->current()));
    }

    public function updateSettings(Request $request)
    {
        $data = $request->validate([
            'monthly_budget_usd' => 'nullable|numeric|min:0',
            'max_questions_per_job' => 'nullable|integer|min:1',
            'max_source_chars' => 'nullable|integer|min:200',
            'batch_size' => 'nullable|integer|min:1|max:50',
            'image_limit_per_job' => 'nullable|integer|min:0',
            'budget_warn_percent' => 'nullable|integer|min:1|max:100',
        ]);

        return response()->json($this->redact($this->settings->update($data)));
    }

    public function usage()
    {
        $rows = AcademyAiUsageRecord::query()->latest()->limit(200)->get()->map(function ($row) {
            return [
                'id' => $row->id,
                'provider' => $row->provider,
                'operation' => $row->operation,
                'model' => $row->model,
                'input_tokens' => $row->input_tokens,
                'output_tokens' => $row->output_tokens,
                'estimated_cost_usd' => $row->estimated_cost_usd,
                'actual_cost_usd' => $row->actual_cost_usd,
                'cost_is_estimated' => $row->cost_is_estimated,
                'provider_request_id' => $row->provider_request_id,
                'provider_task_id' => $row->provider_task_id,
                'created_at' => $row->created_at,
            ];
        });

        return response()->json([
            'month_spend_usd' => $this->settings->current()['month_spend_usd'],
            'data' => $rows,
        ]);
    }

    private function presentJob(AcademyAiGenerationJob $job, bool $detail = false): array
    {
        $payload = $job->toArray();
        if ($detail) {
            $payload['items'] = $job->items;
            $payload['steps'] = $job->steps;
            $payload['snapshots'] = $job->snapshots;
            $payload['media'] = $job->media;
            $payload['usage'] = $job->usageRecords->map(fn ($u) => $u->only([
                'id', 'provider', 'operation', 'model', 'input_tokens', 'output_tokens',
                'estimated_cost_usd', 'actual_cost_usd', 'cost_is_estimated',
            ]));
        }
        $payload['api_key'] = null;

        return $payload;
    }

    private function redact(array $settings): array
    {
        unset($settings['api_key']);
        $settings['openai_key_present'] = $settings['openai_configured'];
        $settings['manus_key_present'] = $settings['manus_configured'];

        return $settings;
    }

    private function resolveEntity(AcademyAiGeneratedItem $item): AcademyCourseVersion|AcademyQuestionVersion|\App\Models\Academy\AcademyCaseVersion|null
    {
        if (! $item->entity_id || ! $item->entity_type) {
            return null;
        }
        if ($item->entity_type === AcademyQuestion::class) {
            return AcademyQuestion::query()->find($item->entity_id)?->versions()->latest('version_number')->first();
        }
        if ($item->entity_type === AcademyCourseVersion::class) {
            return AcademyCourseVersion::query()->find($item->entity_id);
        }
        if ($item->entity_type === AcademyLesson::class) {
            $lesson = AcademyLesson::query()->find($item->entity_id);

            return $lesson?->module?->courseVersion;
        }

        return $item->entity_type::query()->find($item->entity_id);
    }
}

<?php

namespace App\Services\Academy\Ai;

use App\Models\Academy\AcademyAiGeneratedItem;
use App\Models\Academy\AcademyAiGenerationJob;
use App\Models\Academy\AcademyAiGenerationStep;
use App\Models\Academy\AcademyAiMedia;
use App\Models\Academy\AcademyAiPromptRun;
use App\Models\Academy\AcademyQuestion;
use App\Models\User;
use App\Services\Academy\Ai\Dto\ResearchNotes;
use App\Services\Academy\Ai\Exceptions\AcademyAiException;
use App\Services\Academy\Ai\Exceptions\AcademyAiProviderDisabled;
use Illuminate\Support\Facades\Storage;

class AcademyAiOrchestrator
{
    public function __construct(
        private AcademyAiProviderFactory $factory,
        private AcademyAiSourceRetrievalService $retrieval,
        private AcademyAiValidationService $validation,
        private AcademyAiDraftImporter $importer,
        private AcademyAiUsageService $usage,
        private AcademyAiSettingsService $settings,
    ) {}

    public function run(AcademyAiGenerationJob $job): void
    {
        $actor = User::query()->findOrFail($job->requested_by);
        $job->refresh();
        if ($job->isCancelled()) {
            $job->update(['status' => 'cancelled', 'completed_at' => now()]);

            return;
        }

        try {
            $job->update(['started_at' => $job->started_at ?: now()]);
            $this->research($job);
            if ($job->isCancelled()) {
                return;
            }
            $this->blueprint($job, $actor);
            $job->refresh();
            if ($job->type === 'course' && ! $job->blueprint_approved) {
                $job->update(['status' => 'blueprint']);

                return;
            }
            $this->generate($job, $actor);
            $this->validateAndImport($job, $actor);
            if (($job->request_json['generate_images'] ?? false) === true) {
                $this->images($job);
            }
            $job->refresh();
            $failed = $job->items()->whereIn('status', ['rejected_import', 'failed'])->exists();
            $job->update([
                'status' => $failed ? 'partially_failed' : 'draft_ready',
                'completed_at' => now(),
            ]);
        } catch (AcademyAiException $e) {
            $job->update(['status' => 'failed', 'error' => $e->getMessage(), 'completed_at' => now()]);
            throw $e;
        }
    }

    public function research(AcademyAiGenerationJob $job): void
    {
        if ($this->stepDone($job, 'researching')) {
            return;
        }
        $step = $this->beginStep($job, 'researching');
        $job->update(['status' => 'researching']);
        $this->retrieval->snapshotPack($job);

        $provider = $this->factory->research();
        $job->update(['research_provider' => $provider->name()]);
        $notes = $this->runResearch($job, $provider, $step);
        $this->retrieval->ingestResearchCandidates($job, $notes);
        $this->finishStep($step, ['notes' => $notes->notes, 'provider' => $notes->provider, 'task_id' => $notes->providerTaskId]);
    }

    private function runResearch(AcademyAiGenerationJob $job, $provider, AcademyAiGenerationStep $step): ResearchNotes
    {
        $prompt = $this->researchPrompt($job);
        try {
            $notes = $provider->research($job, ['prompt' => $prompt]);
        } catch (AcademyAiException|AcademyAiProviderDisabled $e) {
            if ($provider->name() === 'manus' && config('academy_ai.manus.fallback') === 'openai') {
                $step->update(['error' => $e->getMessage(), 'status' => 'failed']);
                $fallback = app(Providers\OpenAiAcademyResearchProvider::class);
                $job->update(['research_provider' => 'openai']);
                $notes = $fallback->research($job, ['prompt' => $prompt]);
                $this->beginStep($job, 'research_fallback')->update([
                    'status' => 'completed',
                    'provider' => 'openai',
                    'output_ref_json' => ['fallback_from' => 'manus'],
                    'completed_at' => now(),
                ]);

                return $notes;
            }
            throw $e;
        }

        return $notes;
    }

    public function blueprint(AcademyAiGenerationJob $job, User $actor): void
    {
        if ($job->type !== 'course' || $this->stepDone($job, 'blueprint')) {
            return;
        }
        $step = $this->beginStep($job, 'blueprint');
        $job->update(['status' => 'blueprint']);
        if (! $job->blueprint_json) {
            if ($job->exam_id && ! $job->evidence_pack_id) {
                throw new \RuntimeException('Blueprint requires a verified Exam Evidence Pack.');
            }
            $generation = $this->factory->generation();
            $job->update(['generation_provider' => $generation->name()]);
            $evidence = '';
            if ($job->evidence_pack_id) {
                $pack = \App\Models\Academy\AcademyExamEvidencePack::query()->with('items')->find($job->evidence_pack_id);
                $exam = \App\Models\Academy\AcademyExam::query()->find($job->exam_id);
                $evidence = "\nVerified exam structure: ".json_encode($exam?->exam_format_json)
                    ."\nEvidence summary: ".($pack?->research_summary)
                    ."\nPattern metadata: ".json_encode($pack?->pattern_metadata_json)
                    ."\nDo not invent exam structure from model memory.";
            }
            $result = $generation->generateStructured(
                AcademyAiSchemas::courseBlueprint(),
                'course_blueprint',
                AcademyAiPromptCatalog::system('course_blueprint'),
                $this->sourceContext($job)."\nTitle: {$job->title}\nGoal: {$job->goal}".$evidence,
            );
            $this->usage->recordStructured($job->id, 'blueprint', $result, AcademyAiPromptCatalog::version('course_blueprint'), $step->id);
            $this->promptRun($job, $step, 'course_blueprint');
            $job->update(['blueprint_json' => $result->data]);
        }
        $this->finishStep($step, ['blueprint' => $job->fresh()->blueprint_json]);
    }

    public function generate(AcademyAiGenerationJob $job, User $actor): void
    {
        if ($this->stepDone($job, 'generating')) {
            return;
        }
        $step = $this->beginStep($job, 'generating');
        $job->update(['status' => 'generating']);
        $generation = $this->factory->generation();
        $job->update(['generation_provider' => $generation->name()]);
        $request = $job->request_json ?? [];

        if ($job->type === 'course' && ($request['generate_lessons'] ?? true)) {
            $this->generateLessons($job, $generation);
        }
        $wantIndependent = (bool) ($request['generate_independent_mcqs'] ?? in_array($job->type, ['course', 'questions', 'mock_pool'], true));
        $wantCases = (bool) ($request['generate_cases'] ?? in_array($job->type, ['course', 'cases', 'mock_pool'], true));
        $wantCaseMcq = (bool) ($request['generate_case_mcqs'] ?? in_array($job->type, ['course', 'cases', 'mock_pool'], true));
        if ($wantIndependent) {
            $this->generateQuestions($job, $generation, 'independent_mcq', (int) ($request['independent_count'] ?? 0));
        }
        if ($wantCases) {
            $caseCount = (int) ($request['case_count'] ?? max(0, (int) ceil(((int) ($request['case_based_count'] ?? 0)) / 2)));
            if ($caseCount > 0) {
                $this->generateCases($job, $generation, $caseCount);
            }
        }
        if ($wantCaseMcq) {
            $this->generateQuestions($job, $generation, 'case_mcq', (int) ($request['case_based_count'] ?? 0));
        }

        $this->updateProgress($job);
        $this->finishStep($step, ['progress' => $job->fresh()->progress_json]);
    }

    public function validateAndImport(AcademyAiGenerationJob $job, User $actor): void
    {
        if ($this->stepDone($job, 'validating')) {
            return;
        }
        $step = $this->beginStep($job, 'validating');
        $job->update(['status' => 'validating']);

        if ($job->type === 'course' && $job->blueprint_json && ! $job->course_version_id) {
            $this->importer->importCourseShell($job, $actor, $job->blueprint_json);
        }

        $caseVersionId = null;
        foreach ($job->items()->orderBy('id')->get() as $item) {
            if ($item->status === 'draft_imported' || $item->status === 'rejected_import') {
                continue;
            }
            $validation = $this->validation->validateItem($job, $item);
            if (! $validation->structural_ok) {
                $item->update(['status' => 'rejected_import']);

                continue;
            }
            try {
                if ($item->item_type === 'lesson') {
                    $this->importer->importLesson($job, $actor, $item);
                } elseif ($item->item_type === 'case') {
                    $caseVersionId = $this->importer->importCase($job, $actor, $item)->id;
                } elseif (in_array($item->item_type, ['independent_mcq', 'case_mcq'], true)) {
                    $question = $this->importer->importQuestion(
                        $job,
                        $actor,
                        $item,
                        $item->item_type === 'case_mcq' ? $caseVersionId : null
                    );
                    if ($question) {
                        $version = $question->versions()->first();
                        $this->validation->applyQuestionFlags($version, $validation);
                    }
                }
            } catch (\Throwable $e) {
                $item->update(['status' => 'rejected_import']);
            }
            AcademyAiGuard::assertDraftOnly('draft');
        }

        $this->updateProgress($job);
        $this->finishStep($step, ['validated' => true]);
    }

    public function images(AcademyAiGenerationJob $job): void
    {
        if ($this->stepDone($job, 'generating_media')) {
            return;
        }
        $step = $this->beginStep($job, 'generating_media');
        $job->update(['status' => 'generating_media']);
        try {
            $generation = $this->factory->generation();
            $limit = (int) $this->settings->current()['image_limit_per_job'];
            $made = 0;
            if ($job->course_id && $made < $limit) {
                $this->storeImage($job, $generation, 'course_thumbnail', 'Neutral professional study illustration, no seals or official marks.');
                $made++;
            }
            foreach ($job->items()->where('item_type', 'lesson')->get() as $item) {
                if ($made >= $limit) {
                    break;
                }
                $this->storeImage($job, $generation, 'lesson', 'Simple labelled study diagram, no government branding.', $item);
                $made++;
            }
            $this->finishStep($step, ['images' => $made]);
        } catch (AcademyAiException $e) {
            $step->update(['status' => 'failed', 'error' => $e->getMessage(), 'completed_at' => now()]);
        }
    }

    public function regenerateQuestion(AcademyAiGenerationJob $job, User $actor, AcademyQuestion $question): AcademyAiGeneratedItem
    {
        $generation = $this->factory->generation();
        $key = 'regenerate_question:'.$question->id;
        $item = $this->rememberItem($job, 'independent_mcq', $key, function () use ($job, $generation) {
            return $this->oneQuestion($job, $generation, 'independent_mcq', 0);
        });
        $this->validation->validateItem($job, $item);
        if (($item->fresh()->status) !== 'likely_duplicate') {
            $this->importer->importQuestion($job, $actor, $item);
        }

        return $item->fresh();
    }

    private function generateLessons(AcademyAiGenerationJob $job, $generation): void
    {
        $blueprint = $job->blueprint_json ?? [];
        foreach ($blueprint['modules'] ?? [] as $mi => $module) {
            foreach ($module['lesson_outlines'] ?? [] as $li => $outline) {
                $key = 'lesson:'.$mi.':'.$li;
                $this->rememberItem($job, 'lesson', $key, function () use ($job, $generation, $module, $outline, $mi, $li) {
                    $result = $generation->generateStructured(
                        AcademyAiSchemas::lesson(),
                        'lesson',
                        AcademyAiPromptCatalog::system('lesson_writer'),
                        $this->sourceContext($job)."\nModule: {$module['title']}\nLesson: {$outline['title']}\nObjective: {$outline['objective']}",
                    );
                    $this->usage->recordStructured($job->id, 'lesson', $result, AcademyAiPromptCatalog::version('lesson_writer'));
                    $data = $result->data;
                    $data['_module_title'] = $module['title'];
                    $data['_module_index'] = $mi;
                    $data['_lesson_index'] = $li;

                    return [$data, $result->provider, $result->model];
                });
            }
        }
    }

    private function generateCases(AcademyAiGenerationJob $job, $generation, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->rememberItem($job, 'case', 'case:'.$i, function () use ($job, $generation, $i) {
                $result = $generation->generateStructured(
                    AcademyAiSchemas::caseScenario(),
                    'case_scenario',
                    AcademyAiPromptCatalog::system('case_scenario'),
                    $this->sourceContext($job)."\nGenerate reusable case {$i}.",
                    ['index' => $i],
                );
                $this->usage->recordStructured($job->id, 'case', $result, AcademyAiPromptCatalog::version('case_scenario'));

                return [$result->data, $result->provider, $result->model];
            });
        }
    }

    private function generateQuestions(AcademyAiGenerationJob $job, $generation, string $type, int $count): void
    {
        $max = $this->settings->maxQuestions();
        $count = min($count, $max);
        $mix = $job->request_json['difficulty_mix'] ?? [];
        $topics = $job->request_json['topic_mix'] ?? [];
        $batch = $this->settings->batchSize();

        for ($i = 0; $i < $count; $i += $batch) {
            $job->refresh();
            if ($job->isCancelled()) {
                return;
            }
            $take = min($batch, $count - $i);
            for ($j = 0; $j < $take; $j++) {
                $index = $i + $j;
                $difficulty = $this->mixValue($mix, $index, ['easy', 'medium', 'hard']);
                $topic = $this->mixValue($topics, $index, array_values($topics) ? array_keys($topics) : ['irb_foundations']);
                $this->rememberItem($job, $type, $type.':'.$index, function () use ($job, $generation, $type, $index, $difficulty, $topic) {
                    return $this->oneQuestion($job, $generation, $type, $index, $difficulty, $topic);
                });
            }
            $this->updateProgress($job);
        }
    }

    private function oneQuestion(AcademyAiGenerationJob $job, $generation, string $type, int $index, string $difficulty = 'medium', string $topic = 'irb_foundations'): array
    {
        $schema = $type === 'case_mcq' ? AcademyAiSchemas::caseMcq() : AcademyAiSchemas::independentMcq();
        $result = $generation->generateStructured(
            $schema,
            $type,
            AcademyAiPromptCatalog::system($type === 'case_mcq' ? 'case_mcq' : 'independent_mcq'),
            $this->sourceContext($job)."\nRequest title: {$job->title}\nGoal: {$job->goal}\nGenerate {$type} #{$index}. Difficulty {$difficulty}. Topic {$topic}.",
            ['index' => $index, 'difficulty' => $difficulty, 'topic_key' => $topic, 'model_role' => 'fast'],
        );
        $this->usage->recordStructured($job->id, $type, $result, AcademyAiPromptCatalog::version($type === 'case_mcq' ? 'case_mcq' : 'independent_mcq'));

        return [$result->data, $result->provider, $result->model];
    }

    /**
     * @param  array<string, int>  $mix
     * @param  list<string>  $fallback
     */
    private function mixValue(array $mix, int $index, array $fallback): string
    {
        if ($mix === []) {
            return $fallback[$index % count($fallback)];
        }
        $expanded = [];
        foreach ($mix as $key => $n) {
            for ($i = 0; $i < max(0, (int) $n); $i++) {
                $expanded[] = (string) $key;
            }
        }
        if ($expanded === []) {
            return $fallback[0];
        }

        return $expanded[$index % count($expanded)];
    }

    private function rememberItem(AcademyAiGenerationJob $job, string $type, string $key, callable $make): AcademyAiGeneratedItem
    {
        $existing = AcademyAiGeneratedItem::query()
            ->where('generation_job_id', $job->id)
            ->where('item_type', $type)
            ->where('idempotency_key', $key)
            ->first();
        if ($existing) {
            return $existing;
        }

        try {
            [$payload, $provider, $model] = $make();
        } catch (AcademyAiException $e) {
            try {
                [$payload, $provider, $model] = $make();
            } catch (AcademyAiException) {
                return AcademyAiGeneratedItem::query()->create([
                    'generation_job_id' => $job->id,
                    'item_type' => $type,
                    'idempotency_key' => $key,
                    'status' => 'rejected_import',
                    'payload_json' => ['error' => $e->getMessage()],
                    'prompt_key' => $type,
                    'prompt_version' => AcademyAiPromptCatalog::version($type === 'lesson' ? 'lesson_writer' : $type),
                    'provider' => $this->factory->generation()->name(),
                ]);
            }
        }

        return AcademyAiGeneratedItem::query()->create([
            'generation_job_id' => $job->id,
            'item_type' => $type,
            'idempotency_key' => $key,
            'status' => 'generated',
            'payload_json' => $payload,
            'prompt_key' => $type,
            'prompt_version' => AcademyAiPromptCatalog::version($type === 'lesson' ? 'lesson_writer' : $type),
            'provider' => $provider,
            'model' => $model,
        ]);
    }

    private function storeImage(AcademyAiGenerationJob $job, $generation, string $kind, string $prompt, ?AcademyAiGeneratedItem $item = null): void
    {
        $result = $generation->generateImage($prompt);
        $disk = config('academy.media_disk');
        $path = 'ai-media/'.$job->id.'/'.$kind.'-'.uniqid().'.png';
        Storage::disk($disk)->put($path, $result->binary);
        AcademyAiMedia::query()->create([
            'generation_job_id' => $job->id,
            'kind' => $kind,
            'prompt' => $result->prompt,
            'provider' => $result->provider,
            'model' => $result->model,
            'storage_disk' => $disk,
            'storage_path' => $path,
            'approval_status' => 'pending',
            'associated_type' => $item?->entity_type,
            'associated_id' => $item?->entity_id,
            'estimated_cost_usd' => $result->estimatedCostUsd,
            'generated_at' => now(),
        ]);
        $this->usage->record($job->id, $result->provider, 'image', $result->model, null, null, null, $result->estimatedCostUsd);
    }

    private function sourceContext(AcademyAiGenerationJob $job): string
    {
        $parts = $job->snapshots()->where('authoritative', true)->get()->map(
            fn ($s) => AcademyAiPromptCatalog::wrapUntrusted($s->title ?: 'source', (string) $s->excerpt)
        )->all();

        return implode("\n\n", $parts) ?: AcademyAiPromptCatalog::wrapUntrusted('empty', 'No authoritative snapshots yet.');
    }

    private function researchPrompt(AcademyAiGenerationJob $job): string
    {
        return AcademyAiPromptCatalog::system('research_notes')."\nRequest: {$job->title}\nGoal: {$job->goal}\nOnly official Canadian hosts. Do not invent citations.";
    }

    private function beginStep(AcademyAiGenerationJob $job, string $stage): AcademyAiGenerationStep
    {
        return AcademyAiGenerationStep::query()->create([
            'generation_job_id' => $job->id,
            'stage' => $stage,
            'status' => 'running',
            'attempt' => (int) $job->steps()->where('stage', $stage)->max('attempt') + 1,
            'started_at' => now(),
        ]);
    }

    private function finishStep(AcademyAiGenerationStep $step, array $output): void
    {
        $step->update([
            'status' => 'completed',
            'output_ref_json' => $output,
            'completed_at' => now(),
        ]);
    }

    private function stepDone(AcademyAiGenerationJob $job, string $stage): bool
    {
        return $job->steps()->where('stage', $stage)->where('status', 'completed')->exists();
    }

    private function promptRun(AcademyAiGenerationJob $job, AcademyAiGenerationStep $step, string $key): void
    {
        $version = AcademyAiPromptCatalog::version($key);
        AcademyAiPromptRun::query()->create([
            'generation_job_id' => $job->id,
            'step_id' => $step->id,
            'prompt_key' => $key,
            'prompt_version' => $version,
            'prompt_hash' => hash('sha256', AcademyAiPromptCatalog::system($key).'|'.$version),
        ]);
    }

    private function updateProgress(AcademyAiGenerationJob $job): void
    {
        $request = $job->request_json ?? [];
        $job->update([
            'progress_json' => [
                'modules' => $job->items()->where('item_type', 'lesson')->count().'/'.max(1, count($job->blueprint_json['modules'] ?? [])),
                'lessons' => $job->items()->where('item_type', 'lesson')->count().'/'.max(1, $this->lessonTarget($job)),
                'questions' => $job->items()->whereIn('item_type', ['independent_mcq', 'case_mcq'])->count().'/'.((int) ($request['independent_count'] ?? 0) + (int) ($request['case_based_count'] ?? 0)),
                'validation' => $job->items()->whereHas('validation')->count().'/'.$job->items()->count(),
            ],
        ]);
    }

    private function lessonTarget(AcademyAiGenerationJob $job): int
    {
        $n = 0;
        foreach ($job->blueprint_json['modules'] ?? [] as $module) {
            $n += count($module['lesson_outlines'] ?? []);
        }

        return $n;
    }
}

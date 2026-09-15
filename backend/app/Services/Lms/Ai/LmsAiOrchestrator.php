<?php

namespace App\Services\Lms\Ai;

use App\Models\Lms\LmsAiGeneratedItem;
use App\Models\Lms\LmsAiGenerationJob;
use App\Models\Lms\LmsAiGenerationStep;
use App\Models\Lms\LmsAiSourceSnapshot;
use App\Models\Lms\LmsExam;
use App\Models\Lms\LmsExamEvidencePack;
use App\Models\User;
use App\Services\Academy\Ai\AcademyAiProviderFactory;
use App\Services\Academy\Ai\AcademyAiSchemas;
use App\Services\Academy\Ai\Exceptions\AcademyAiException;
use App\Services\Learning\ExamEvidencePackService;

class LmsAiOrchestrator
{
    public function __construct(
        private AcademyAiProviderFactory $factory,
        private LmsAiValidationService $validation,
        private LmsAiDraftImporter $importer,
        private LmsAiUsageService $usage,
    ) {}

    public function run(LmsAiGenerationJob $job): void
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
            $this->blueprint($job);
            $job->refresh();
            if ($job->type === 'course' && ! $job->blueprint_approved) {
                $job->update(['status' => 'blueprint']);

                return;
            }
            $this->generate($job);
            $this->validateAndImport($job, $actor);
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

    public function research(LmsAiGenerationJob $job): void
    {
        if ($this->stepDone($job, 'researching')) {
            return;
        }
        $step = $this->beginStep($job, 'researching');
        $job->update(['status' => 'researching']);
        $this->snapshotEvidencePack($job);

        $generation = $this->factory->generation();
        $job->update(['research_provider' => $generation->name()]);
        $profile = (string) $job->generation_profile;
        $result = $generation->generateStructured(
            AcademyAiSchemas::researchNotes(),
            'research_notes',
            LmsAiPromptCatalog::system('research_notes', $profile),
            $this->sourceContext($job)."\nRequest: {$job->title}\nGoal: {$job->goal}\nProfile: {$profile}\nManus-discovered URLs are candidates only.",
            ['generation_profile' => $profile],
        );
        $this->usage->recordStructured($job->id, 'research', $result, LmsAiPromptCatalog::version('research_notes', $profile), $step->id);
        $job->update([
            'manus_research_json' => [
                'notes' => $result->data['notes'] ?? null,
                'candidate_sources' => $result->data['candidate_sources'] ?? [],
                'provider' => $result->provider,
                'candidate_only' => true,
            ],
            'openai_verification_json' => [
                'provider' => $result->provider,
                'verified_from_evidence_pack' => true,
            ],
        ]);
        $this->ingestCandidates($job, $result->data['candidate_sources'] ?? []);
        $this->finishStep($step, ['notes' => $result->data['notes'] ?? null, 'provider' => $result->provider]);
    }

    public function blueprint(LmsAiGenerationJob $job): void
    {
        if ($job->type !== 'course' || $this->stepDone($job, 'blueprint')) {
            return;
        }
        $step = $this->beginStep($job, 'blueprint');
        $job->update(['status' => 'outlining']);
        if (! $job->blueprint_json) {
            if (! $job->evidence_pack_id) {
                throw new AcademyAiException('Blueprint requires a verified Exam Evidence Pack.');
            }
            if ($job->snapshots()->where('authoritative', true)->doesntExist()) {
                throw new AcademyAiException('Blueprint requires verified Evidence Pack snapshots. OpenAI cannot generate from model memory.');
            }
            $generation = $this->factory->generation();
            $job->update(['generation_provider' => $generation->name()]);
            $profile = (string) $job->generation_profile;
            $request = $job->request_json ?? [];
            $exam = LmsExam::query()->find($job->exam_id);
            $pack = LmsExamEvidencePack::query()->find($job->evidence_pack_id);
            $evidence = "\nVerified exam structure: ".json_encode($exam?->exam_format_json)
                ."\nEvidence summary: ".($pack?->research_summary)
                ."\nDo not invent exam structure from model memory."
                ."\nRequested modules: ".(int) ($request['module_count'] ?? 1)
                ."\nRequested lessons: ".(int) ($request['lesson_count'] ?? 2);
            $result = $generation->generateStructured(
                AcademyAiSchemas::courseBlueprint(),
                'course_blueprint',
                LmsAiPromptCatalog::system('course_blueprint', $profile),
                $this->sourceContext($job)."\nTitle: {$job->title}\nGoal: {$job->goal}\nProfile: {$profile}".$evidence,
                [
                    'generation_profile' => $profile,
                    'module_count' => (int) ($request['module_count'] ?? 1),
                    'lesson_count' => (int) ($request['lesson_count'] ?? 2),
                ],
            );
            $this->usage->recordStructured($job->id, 'blueprint', $result, LmsAiPromptCatalog::version('course_blueprint', $profile), $step->id);
            $job->update(['blueprint_json' => $this->applyRequestedShape($result->data, $request)]);
        }
        $this->finishStep($step, ['blueprint' => $job->fresh()->blueprint_json]);
    }

    public function generate(LmsAiGenerationJob $job): void
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
        $wantIndependent = (bool) ($request['generate_independent_mcqs'] ?? true);
        if ($wantIndependent) {
            $this->generateQuestions($job, $generation, (int) ($request['independent_count'] ?? 0));
        }

        $this->updateProgress($job);
        $this->finishStep($step, ['progress' => $job->fresh()->progress_json]);
    }

    public function validateAndImport(LmsAiGenerationJob $job, User $actor): void
    {
        if ($this->stepDone($job, 'validating')) {
            return;
        }
        $step = $this->beginStep($job, 'validating');
        $job->update(['status' => 'validating']);

        if ($job->type === 'course' && $job->blueprint_json) {
            $this->importer->importCourseDraft($job, $actor, $job->blueprint_json);
        }

        foreach ($job->items()->orderBy('id')->get() as $item) {
            if ($item->status === 'draft_imported' || $item->status === 'rejected_import') {
                if ($item->status === 'draft_imported' && in_array($item->item_type, ['independent_mcq', 'topic_quiz'], true)) {
                    $this->importer->importQuestion($job, $actor, $item);
                }

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
                } elseif (in_array($item->item_type, ['independent_mcq', 'topic_quiz'], true)) {
                    $question = $this->importer->importQuestion($job, $actor, $item);
                    if ($question) {
                        $version = $question->versions()->first();
                        if ($version) {
                            $this->validation->applyQuestionFlags($version, $validation);
                        }
                    }
                }
            } catch (\Throwable $e) {
                $item->update(['status' => 'rejected_import']);
            }
            $course = $job->course_id ? \App\Models\Lms\LmsCourse::query()->find($job->course_id) : null;
            if ($course) {
                LmsAiGuard::assertDraftOnly((string) $course->review_status, (bool) $course->is_published);
            }
        }

        $request = $job->request_json ?? [];
        if ($request['include_mock'] ?? true) {
            $this->importer->importMockTemplate($job, $actor);
        }

        $job->update(['coverage_json' => $this->coverage($job)]);
        $this->importer->assertNonEmptyImport($job->fresh());
        $this->updateProgress($job);
        $this->finishStep($step, ['validated' => true]);
    }

    /**
     * @param  array<string, mixed>  $request
     * @param  array<string, mixed>  $blueprint
     * @return array<string, mixed>
     */
    private function applyRequestedShape(array $blueprint, array $request): array
    {
        $moduleCount = max(1, (int) ($request['module_count'] ?? 1));
        $lessonCount = max(1, (int) ($request['lesson_count'] ?? 2));
        $modules = array_values(array_slice($blueprint['modules'] ?? [], 0, $moduleCount));
        if ($modules === []) {
            $modules = [[
                'title' => 'Study module',
                'objective' => 'Cover the official study guide.',
                'lesson_outlines' => [],
            ]];
        }
        $per = (int) ceil($lessonCount / max(1, count($modules)));
        $remaining = $lessonCount;
        foreach ($modules as $i => $module) {
            $take = $i === array_key_last($modules) ? $remaining : min($per, $remaining);
            $outlines = array_values(array_slice($module['lesson_outlines'] ?? [], 0, $take));
            while (count($outlines) < $take) {
                $n = count($outlines) + 1;
                $outlines[] = ['title' => 'Lesson '.$n, 'objective' => 'Study the official guide.'];
            }
            $modules[$i]['lesson_outlines'] = $outlines;
            $remaining -= count($outlines);
        }
        $blueprint['modules'] = $modules;

        return $blueprint;
    }

    private function generateLessons(LmsAiGenerationJob $job, $generation): void
    {
        $blueprint = $job->blueprint_json ?? [];
        $profile = (string) $job->generation_profile;
        foreach ($blueprint['modules'] ?? [] as $mi => $module) {
            foreach ($module['lesson_outlines'] ?? [] as $li => $outline) {
                $key = 'lesson:'.$mi.':'.$li;
                $this->rememberItem($job, 'lesson', $key, function () use ($job, $generation, $module, $outline, $mi, $li, $profile) {
                    $result = $generation->generateStructured(
                        AcademyAiSchemas::lesson(),
                        'lesson',
                        LmsAiPromptCatalog::system('lesson_writer', $profile),
                        $this->sourceContext($job)."\nProfile: {$profile}\nModule: {$module['title']}\nLesson: {$outline['title']}\nObjective: {$outline['objective']}",
                        ['generation_profile' => $profile],
                    );
                    $this->usage->recordStructured($job->id, 'lesson', $result, LmsAiPromptCatalog::version('lesson_writer', $profile));
                    $data = $result->data;
                    $data['_module_title'] = $module['title'];
                    $data['_module_index'] = $mi;
                    $data['_lesson_index'] = $li;

                    return [$data, $result->provider, $result->model];
                });
            }
        }
    }

    private function generateQuestions(LmsAiGenerationJob $job, $generation, int $count): void
    {
        $count = max(0, min($count, (int) config('academy_ai.limits.max_questions_per_job', 40)));
        $profile = (string) $job->generation_profile;
        $mix = $job->request_json['difficulty_mix'] ?? [];
        $topics = $job->request_json['topic_mix'] ?? ['rights' => 1, 'history' => 1];

        for ($index = 0; $index < $count; $index++) {
            $job->refresh();
            if ($job->isCancelled()) {
                return;
            }
            $difficulty = $this->mixValue($mix, $index, ['easy', 'medium', 'hard']);
            $topic = $this->mixValue($topics, $index, array_keys($topics) ?: ['rights_and_responsibilities']);
            $this->rememberItem($job, 'independent_mcq', 'independent_mcq:'.$index, function () use ($job, $generation, $index, $difficulty, $topic, $profile) {
                $result = $generation->generateStructured(
                    AcademyAiSchemas::independentMcq(),
                    'independent_mcq',
                    LmsAiPromptCatalog::system('independent_mcq', $profile),
                    $this->sourceContext($job)."\nProfile: {$profile}\nRequest title: {$job->title}\nGenerate independent_mcq #{$index}. Difficulty {$difficulty}. Topic {$topic}. practice_eligible=true mock_eligible=true.",
                    [
                        'index' => $index,
                        'difficulty' => $difficulty,
                        'topic_key' => $topic,
                        'generation_profile' => $profile,
                    ],
                );
                $this->usage->recordStructured($job->id, 'independent_mcq', $result, LmsAiPromptCatalog::version('independent_mcq', $profile));
                $data = $result->data;
                $data['practice_eligible'] = true;
                $data['mock_eligible'] = true;

                return [$data, $result->provider, $result->model];
            });
        }
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

    private function rememberItem(LmsAiGenerationJob $job, string $type, string $key, callable $make): LmsAiGeneratedItem
    {
        $existing = LmsAiGeneratedItem::query()
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
                return LmsAiGeneratedItem::query()->create([
                    'generation_job_id' => $job->id,
                    'item_type' => $type,
                    'idempotency_key' => $key,
                    'status' => 'rejected_import',
                    'payload_json' => ['error' => $e->getMessage()],
                    'prompt_key' => $type,
                    'prompt_version' => LmsAiPromptCatalog::version($type === 'lesson' ? 'lesson_writer' : $type, (string) $job->generation_profile),
                    'provider' => $this->factory->generation()->name(),
                ]);
            }
        }

        return LmsAiGeneratedItem::query()->create([
            'generation_job_id' => $job->id,
            'item_type' => $type,
            'idempotency_key' => $key,
            'status' => 'generated',
            'payload_json' => $payload,
            'prompt_key' => $type,
            'prompt_version' => LmsAiPromptCatalog::version($type === 'lesson' ? 'lesson_writer' : $type, (string) $job->generation_profile),
            'provider' => $provider,
            'model' => $model,
        ]);
    }

    private function snapshotEvidencePack(LmsAiGenerationJob $job): void
    {
        $pack = LmsExamEvidencePack::query()->with('items')->find($job->evidence_pack_id);
        if (! $pack) {
            throw new AcademyAiException('Evidence Pack is required for LMS generation.');
        }
        $allowed = config('learning.official_hosts.'.$job->generation_profile, []);
        foreach ($pack->items as $item) {
            if ($item->disabled) {
                continue;
            }
            $exists = LmsAiSourceSnapshot::query()
                ->where('generation_job_id', $job->id)
                ->where('evidence_item_id', $item->id)
                ->exists();
            if ($exists) {
                continue;
            }
            $host = strtolower((string) parse_url((string) $item->url, PHP_URL_HOST));
            $allowlisted = in_array($host, $allowed, true);
            $authoritative = $allowlisted
                && $item->is_official
                && $item->verification_status === 'verified'
                && $item->classification_flag !== 'unverified_exam_material';
            LmsAiSourceSnapshot::query()->create([
                'generation_job_id' => $job->id,
                'evidence_item_id' => $item->id,
                'title' => $item->title,
                'url' => $item->url,
                'organization' => $item->authority,
                'version_label' => $item->version_label,
                'retrieved_at' => $item->retrieved_at ?: now(),
                'content_hash' => $item->content_hash,
                'excerpt' => $item->excerpt,
                'retrieval_method' => 'evidence_pack',
                'allowlisted' => $allowlisted,
                'authoritative' => $authoritative,
                'candidate_only' => false,
            ]);
        }
    }

    /**
     * @param  list<array<string, mixed>>  $candidates
     */
    private function ingestCandidates(LmsAiGenerationJob $job, array $candidates): void
    {
        foreach ($candidates as $i => $candidate) {
            $url = (string) ($candidate['url'] ?? '');
            if ($url === '') {
                continue;
            }
            $exists = LmsAiSourceSnapshot::query()
                ->where('generation_job_id', $job->id)
                ->where('url', $url)
                ->where('candidate_only', true)
                ->exists();
            if ($exists) {
                continue;
            }
            LmsAiSourceSnapshot::query()->create([
                'generation_job_id' => $job->id,
                'title' => $candidate['title'] ?? 'Candidate source',
                'url' => $url,
                'organization' => $candidate['organization'] ?? null,
                'excerpt' => $candidate['excerpt'] ?? null,
                'retrieved_at' => now(),
                'retrieval_method' => 'manus_candidate',
                'allowlisted' => false,
                'authoritative' => false,
                'candidate_only' => true,
            ]);
        }
    }

    private function sourceContext(LmsAiGenerationJob $job): string
    {
        $parts = $job->snapshots()->where('authoritative', true)->get()->map(
            fn ($s) => LmsAiPromptCatalog::wrapUntrusted($s->title ?: 'source', (string) $s->excerpt)
        )->all();

        return implode("\n\n", $parts) ?: LmsAiPromptCatalog::wrapUntrusted('empty', 'No authoritative snapshots yet.');
    }

    /** @return array<string, mixed> */
    private function coverage(LmsAiGenerationJob $job): array
    {
        $exam = LmsExam::query()->find($job->exam_id);
        $requiredTopics = collect($exam?->exam_format_json['topics'] ?? [])->filter()->values()->all();
        $covered = $job->items()
            ->whereIn('item_type', ['independent_mcq', 'topic_quiz'])
            ->get()
            ->flatMap(fn ($item) => $item->payload_json['topic_keys'] ?? [])
            ->unique()
            ->values()
            ->all();

        return app(ExamEvidencePackService::class)->coverageReport(
            [],
            [],
            $requiredTopics,
            $covered,
            collect($exam?->exam_format_json['sections'] ?? [])->filter()->values()->all(),
            $covered
        );
    }

    private function beginStep(LmsAiGenerationJob $job, string $stage): LmsAiGenerationStep
    {
        return LmsAiGenerationStep::query()->create([
            'generation_job_id' => $job->id,
            'stage' => $stage,
            'status' => 'running',
            'attempt' => (int) $job->steps()->where('stage', $stage)->max('attempt') + 1,
            'started_at' => now(),
        ]);
    }

    private function finishStep(LmsAiGenerationStep $step, array $output): void
    {
        $step->update([
            'status' => 'completed',
            'output_ref_json' => $output,
            'completed_at' => now(),
        ]);
    }

    private function stepDone(LmsAiGenerationJob $job, string $stage): bool
    {
        return $job->steps()->where('stage', $stage)->where('status', 'completed')->exists();
    }

    private function updateProgress(LmsAiGenerationJob $job): void
    {
        $request = $job->request_json ?? [];
        $job->update([
            'progress_json' => [
                'modules' => $job->items()->where('item_type', 'lesson')->count().'/'.max(1, count($job->blueprint_json['modules'] ?? [])),
                'lessons' => $job->items()->where('item_type', 'lesson')->count().'/'.max(1, $this->lessonTarget($job)),
                'questions' => $job->items()->where('item_type', 'independent_mcq')->count().'/'.(int) ($request['independent_count'] ?? 0),
                'validation' => $job->items()->whereHas('validation')->count().'/'.$job->items()->count(),
            ],
        ]);
    }

    private function lessonTarget(LmsAiGenerationJob $job): int
    {
        $n = 0;
        foreach ($job->blueprint_json['modules'] ?? [] as $module) {
            $n += count($module['lesson_outlines'] ?? []);
        }

        return $n;
    }
}

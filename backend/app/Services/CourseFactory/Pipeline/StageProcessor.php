<?php

namespace App\Services\CourseFactory\Pipeline;

use App\Jobs\CourseFactory\AdvanceCourseFactoryJob;
use App\Models\CourseFactory\CfCaseBank;
use App\Models\CourseFactory\CfContentValidation;
use App\Models\CourseFactory\CfExamBlueprint;
use App\Models\CourseFactory\CfGenerationRun;
use App\Models\CourseFactory\CfGenerationStep;
use App\Models\CourseFactory\CfMockExamBlueprint;
use App\Models\CourseFactory\CfResearchSource;
use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsHomework;
use App\Models\Lms\LmsLesson;
use App\Models\Lms\LmsModule;
use App\Models\Lms\LmsQuestionBank;
use App\Models\Lms\LmsQuestionBankOption;
use App\Models\Lms\LmsQuiz;
use App\Models\Lms\LmsQuizBankQuestion;
use App\Services\CourseFactory\Manus\ManusV2Client;
use App\Services\CourseFactory\OpenAi\OpenAiClient;
use App\Services\CourseFactory\Prompts\PromptCatalog;
use App\Services\CourseFactory\Schemas\CourseFactorySchemas;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StageProcessor
{
    public function __construct(
        private OpenAiClient $openai,
        private ManusV2Client $manus,
        private GenerationEventWriter $events,
    ) {}

    /** @return array<string, mixed> */
    public function run(CfGenerationRun $run, CfGenerationStep $step): array
    {
        return match ($step->step_key) {
            'exam_discovery' => $this->examDiscovery($run, $step),
            'manus_deep_research' => $this->manusDeepResearch($run, $step),
            'source_library' => $this->sourceLibrary($run, $step),
            'research_verification' => $this->researchVerification($run, $step),
            'exam_blueprint' => $this->examBlueprint($run, $step),
            'course_metadata' => $this->courseMetadata($run, $step),
            'thumbnail' => $this->thumbnail($run, $step),
            'course_architecture' => $this->courseArchitecture($run, $step),
            'lesson_content' => $this->lessonContent($run, $step),
            'lesson_images' => $this->lessonImages($run, $step),
            'lesson_practice' => $this->lessonPractice($run, $step),
            'module_quizzes' => $this->moduleQuizzes($run, $step),
            'assignments' => $this->assignments($run, $step),
            'question_bank' => $this->questionBank($run, $step),
            'case_bank' => $this->caseBank($run, $step),
            'mock_exam' => $this->mockExam($run, $step),
            'answer_validation' => $this->answerValidation($run, $step),
            'manus_factual_validation' => $this->manusFactualValidation($run, $step),
            'coverage_audit' => $this->coverageAudit($run, $step),
            'completeness_gate' => $this->completenessGate($run, $step),
            'admin_review' => ['status' => 'completed', 'message' => 'Ready for admin review', 'agent' => 'Orchestrator'],
            default => throw new \RuntimeException('Unknown step: '.$step->step_key),
        };
    }

    public function completeManusResearch(CfGenerationRun $run, CfGenerationStep $step, array $structured): void
    {
        $structured = $this->unwrapStructuredPayload($structured);

        $run->update([
            'research_json' => $structured,
            'canonical_exam_name' => $structured['exam_name'] ?? $run->canonical_exam_name,
        ]);
        $step->update([
            'status' => 'completed',
            'progress' => 100,
            'completed_at' => now(),
            'metadata' => array_merge($step->metadata ?? [], [
                'structured_keys' => array_keys($structured),
                'source_count' => is_array($structured['sources'] ?? null) ? count($structured['sources']) : 0,
            ]),
        ]);
        $this->events->write($run, 'research_completed', 'Deep research completed', 'Manus structured research stored.', 'Manus');
        AdvanceCourseFactoryJob::dispatch($run->id);
    }

    /**
     * Manus structured_output_result may arrive as either the schema object itself
     * or an envelope: { success: true, value: {...} }.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function unwrapStructuredPayload(array $payload): array
    {
        if (isset($payload['value']) && is_array($payload['value']) && array_key_exists('success', $payload)) {
            return $payload['value'];
        }

        if (isset($payload['data']) && is_array($payload['data']) && ! isset($payload['sources']) && ! isset($payload['exam_name'])) {
            return $payload['data'];
        }

        return $payload;
    }

    private function examDiscovery(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $this->events->write($run, 'research_started', 'Discovering exam identity', $run->exam_name, 'OpenAI');
        $result = $this->openai->structured(
            PromptCatalog::examDiscoverySystem(),
            "Discover the Canadian professional/licensing exam named: {$run->exam_name}\nReturn authoritative discovery fields only.",
            CourseFactorySchemas::examDiscovery(),
            'exam_discovery',
            (string) config('course_factory.openai.reasoning_model')
        );
        $this->events->trackUsage($run, 'openai', $result['model'], $result['usage'], $step->id);
        $data = $result['data'];
        $run->update([
            'canonical_exam_name' => $data['canonical_exam_name'] ?? $run->exam_name,
            'provider_metadata' => array_merge($run->provider_metadata ?? [], ['discovery' => $data]),
        ]);
        $this->events->write($run, 'exam_discovered', 'Exam discovery complete', $data['canonical_exam_name'] ?? null, 'OpenAI', $data);

        return ['status' => 'completed', 'message' => 'Canonical exam identified', 'agent' => 'OpenAI', 'metadata' => ['discovery' => $data]];
    }

    private function manusDeepResearch(CfGenerationRun $run, CfGenerationStep $step): array
    {
        if ($step->external_task_id) {
            return [
                'status' => 'waiting_external',
                'external_provider' => 'manus',
                'external_task_id' => $step->external_task_id,
            ];
        }

        $discovery = $run->provider_metadata['discovery'] ?? [];
        $prompt = $this->manusResearchPrompt($run->exam_name, $discovery);
        $this->events->write($run, 'research_started', 'Manus deep research started', 'Creating async Manus task…', 'Manus');

        $created = $this->manus->createTask(
            $prompt,
            CourseFactorySchemas::manusResearch(),
            'Course Factory research: '.$run->exam_name,
            false
        );

        $this->events->trackUsage($run, 'manus', 'manus-v2', [], $step->id, 0, 1);
        $taskId = (string) ($created['task_id'] ?? '');
        if ($taskId === '') {
            throw new \RuntimeException('Manus did not return task_id.');
        }

        $this->events->write($run, 'manus_task_created', 'Manus task created', $taskId, 'Manus', [
            'task_url' => $created['task_url'] ?? null,
        ]);

        return [
            'status' => 'waiting_external',
            'external_provider' => 'manus',
            'external_task_id' => $taskId,
            'metadata' => ['task_url' => $created['task_url'] ?? null],
            'agent' => 'Manus',
        ];
    }

    private function sourceLibrary(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $research = $this->unwrapStructuredPayload($run->research_json ?? []);
        if ($research !== ($run->research_json ?? [])) {
            $run->update([
                'research_json' => $research,
                'canonical_exam_name' => $research['exam_name'] ?? $run->canonical_exam_name,
            ]);
        }

        $sources = $research['sources'] ?? [];
        if (! is_array($sources)) {
            $sources = [];
        }

        // Recover useful URLs when Manus omitted a formal sources array.
        if ($sources === []) {
            foreach ([
                ['title' => 'Official candidate handbook', 'url' => $research['candidate_handbook_url'] ?? null, 'tier' => 1],
                ['title' => 'Official exam page', 'url' => $research['official_exam_url'] ?? null, 'tier' => 1],
            ] as $fallback) {
                if (! empty($fallback['url']) && is_string($fallback['url'])) {
                    $sources[] = [
                        'title' => $fallback['title'],
                        'url' => $fallback['url'],
                        'organization' => $research['regulator'] ?? 'Unknown',
                        'source_type' => 'official',
                        'authority_tier' => $fallback['tier'],
                        'publication_date' => null,
                        'notes' => 'Recovered from research dossier URL fields.',
                        'topics' => [],
                    ];
                }
            }
        }

        $count = 0;
        foreach ($sources as $src) {
            if (! is_array($src)) {
                continue;
            }
            $url = $src['url'] ?? null;
            if (! is_string($url) || trim($url) === '') {
                continue;
            }
            CfResearchSource::query()->updateOrCreate(
                [
                    'generation_run_id' => $run->id,
                    'url' => $url,
                ],
                [
                    'course_id' => $run->course_id,
                    'title' => $src['title'] ?? 'Untitled source',
                    'organization' => $src['organization'] ?? null,
                    'source_type' => $src['source_type'] ?? null,
                    'authority_tier' => (int) ($src['authority_tier'] ?? 3),
                    'published_on' => $this->nullableDate($src['publication_date'] ?? null),
                    'accessed_at' => now(),
                    'research_notes' => $src['notes'] ?? null,
                    'relevant_topics' => $src['topics'] ?? [],
                    'verified' => ((int) ($src['authority_tier'] ?? 3)) <= 2,
                ]
            );
            $count++;
            $this->events->write($run, 'research_source_found', 'Source recorded', $src['title'] ?? $url, 'Manus');
        }

        if ($count === 0) {
            throw new \RuntimeException('No authoritative sources found in research dossier.');
        }

        return ['status' => 'completed', 'generated_records_count' => $count, 'message' => "{$count} sources normalized", 'agent' => 'Orchestrator'];
    }

    private function researchVerification(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $meta = $step->metadata ?? [];
        if (! empty($meta['followup_task_id']) && empty($meta['followup_done'])) {
            return [
                'status' => 'waiting_external',
                'external_provider' => 'manus',
                'external_task_id' => $meta['followup_task_id'],
                'metadata' => $meta,
            ];
        }

        $result = $this->openai->structured(
            PromptCatalog::researchVerificationSystem(),
            "Verify this exam research dossier:\n".json_encode($run->research_json, JSON_PRETTY_PRINT),
            CourseFactorySchemas::verification(),
            'research_verification',
            (string) config('course_factory.openai.reasoning_model')
        );
        $this->events->trackUsage($run, 'openai', $result['model'], $result['usage'], $step->id);
        $data = $result['data'];
        $run->update(['verification_json' => $data]);

        if (! ($data['is_sufficient'] ?? false) && ! empty($data['follow_up_research_prompt'])) {
            $created = $this->manus->createTask(
                (string) $data['follow_up_research_prompt'],
                CourseFactorySchemas::manusResearch(),
                'Course Factory follow-up research: '.$run->exam_name,
                false
            );
            $this->events->trackUsage($run, 'manus', 'manus-v2', [], $step->id, 0, 1);
            $this->events->write($run, 'followup_research_started', 'Launching follow-up Manus research', $data['notes'] ?? null, 'Manus');

            return [
                'status' => 'waiting_external',
                'external_provider' => 'manus',
                'external_task_id' => $created['task_id'] ?? null,
                'metadata' => ['followup_task_id' => $created['task_id'] ?? null, 'followup_done' => false],
            ];
        }

        return ['status' => 'completed', 'message' => 'Research verification passed', 'agent' => 'OpenAI', 'metadata' => ['verification' => $data]];
    }

    private function examBlueprint(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $research = $run->research_json ?? [];
        $result = $this->openai->structured(
            PromptCatalog::blueprintSystem(),
            "Normalize into an exam blueprint. Do not invent unknown numbers.\n".json_encode([
                'research' => $research,
                'verification' => $run->verification_json,
            ], JSON_PRETTY_PRINT),
            CourseFactorySchemas::manusResearch(),
            'exam_blueprint',
            (string) config('course_factory.openai.reasoning_model')
        );
        $this->events->trackUsage($run, 'openai', $result['model'], $result['usage'], $step->id);
        $data = $result['data'];

        CfExamBlueprint::query()->updateOrCreate(
            ['generation_run_id' => $run->id],
            [
                'course_id' => $run->course_id,
                'exam_name' => $data['exam_name'] ?? $run->canonical_exam_name ?? $run->exam_name,
                'regulator' => $data['regulator'] ?? null,
                'target_candidate' => $run->provider_metadata['discovery']['target_candidate'] ?? null,
                'question_count' => $data['question_count'] ?? null,
                'duration_minutes' => $data['duration_minutes'] ?? null,
                'question_formats' => $data['question_types'] ?? [],
                'has_case_questions' => collect($data['question_types'] ?? [])->contains(fn ($t) => str_contains(strtolower((string) $t), 'case')),
                'domains' => $data['domains'] ?? [],
                'competencies' => collect($data['domains'] ?? [])->flatMap(fn ($d) => $d['competencies'] ?? [])->values()->all(),
                'legislation_topics' => array_merge($data['legislation'] ?? [], $data['regulations'] ?? []),
                'official_references' => collect($data['sources'] ?? [])->pluck('url')->filter()->values()->all(),
                'knowledge_cutoff_policy' => $data['knowledge_cutoff_notes'] ?? null,
                'source_confidence' => $run->verification_json['confidence'] ?? null,
                'unknown_fields' => $data['unknown_fields'] ?? [],
                'raw_json' => $data,
                'last_verified_at' => now(),
            ]
        );

        $this->events->write($run, 'blueprint_completed', 'Exam blueprint ready', null, 'OpenAI');

        return ['status' => 'completed', 'generated_records_count' => 1, 'agent' => 'OpenAI'];
    }

    private function courseMetadata(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $bp = CfExamBlueprint::query()->where('generation_run_id', $run->id)->firstOrFail();
        $result = $this->openai->structured(
            'Create course marketing/metadata for an unpublished exam-prep course. Do not claim regulator endorsement.',
            json_encode([
                'exam' => $bp->exam_name,
                'regulator' => $bp->regulator,
                'domains' => $bp->domains,
                'unknown_fields' => $bp->unknown_fields,
            ], JSON_PRETTY_PRINT),
            CourseFactorySchemas::courseMetadata(),
            'course_metadata',
            (string) config('course_factory.openai.text_model')
        );
        $this->events->trackUsage($run, 'openai', $result['model'], $result['usage'], $step->id);
        $data = $result['data'];

        LmsCourse::query()->where('id', $run->course_id)->update([
            'title' => $data['title'],
            'slug' => Str::slug($data['slug']).'-'.$run->id,
            'subtitle' => $data['subtitle'] ?? null,
            'description' => $data['full_description'],
            'short_description' => $data['short_description'],
            'learning_objectives_json' => $data['learning_objectives'],
            'estimated_hours' => $data['estimated_hours'],
            'difficulty' => $data['difficulty'],
            'regulator' => $bp->regulator,
            'tags_json' => $data['tags'],
            'seo_json' => [
                'title' => $data['seo_title'],
                'description' => $data['seo_description'],
            ],
            'review_status' => 'generating',
            'is_published' => false,
            'exam_id' => null,
        ]);

        return ['status' => 'completed', 'agent' => 'OpenAI', 'message' => $data['title']];
    }

    private function thumbnail(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $course = LmsCourse::query()->findOrFail($run->course_id);
        $promptResult = $this->openai->text(
            'Create a concise image generation prompt for a professional Canadian exam-prep course thumbnail. No logos, seals, or endorsement claims.',
            "Course: {$course->title}\nRegulator context: {$course->regulator}\nBrand: RCIC Master"
        );
        $this->events->trackUsage($run, 'openai', $promptResult['model'], $promptResult['usage'], $step->id);
        $imagePrompt = trim($promptResult['text']);
        $this->events->write($run, 'thumbnail_started', 'Generating thumbnail', $imagePrompt, 'OpenAI');

        $image = $this->openai->generateImage($imagePrompt);
        $this->events->trackUsage($run, 'openai', $image['model'], [], $step->id, 1);

        $path = 'course-factory/'.$run->id.'/thumbnail.png';
        $disk = Storage::disk('public');
        if (! empty($image['b64_json'])) {
            $disk->put($path, base64_decode($image['b64_json']));
        } elseif (! empty($image['url'])) {
            $bytes = Http::timeout(60)->get($image['url'])->body();
            if ($bytes === '' || $bytes === false) {
                throw new \RuntimeException('Could not download generated thumbnail.');
            }
            $disk->put($path, $bytes);
        } else {
            throw new \RuntimeException('Thumbnail generation returned no image.');
        }

        $url = rtrim((string) config('app.url'), '/').'/storage/'.$path;
        $course->update(['thumbnail_url' => $url]);
        $this->events->write($run, 'thumbnail_completed', 'Thumbnail generated', $url, 'OpenAI', [
            'prompt' => $imagePrompt,
            'path' => $path,
        ]);

        return ['status' => 'completed', 'generated_records_count' => 1, 'agent' => 'OpenAI', 'metadata' => ['thumbnail_prompt' => $imagePrompt, 'thumbnail_url' => $url]];
    }

    private function courseArchitecture(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $bp = CfExamBlueprint::query()->where('generation_run_id', $run->id)->firstOrFail();
        $result = $this->openai->structured(
            PromptCatalog::architectureSystem(),
            "Build complete curriculum architecture mapped to this blueprint:\n".json_encode($bp->raw_json ?? $bp->toArray(), JSON_PRETTY_PRINT),
            CourseFactorySchemas::architecture(),
            'course_architecture',
            (string) config('course_factory.openai.reasoning_model')
        );
        $this->events->trackUsage($run, 'openai', $result['model'], $result['usage'], $step->id);
        $data = $result['data'];

        // Idempotent rebuild of modules/lessons shells
        LmsModule::query()->where('course_id', $run->course_id)->each(function (LmsModule $m) {
            LmsLesson::query()->where('module_id', $m->id)->delete();
            $m->delete();
        });

        $moduleCount = 0;
        $lessonCount = 0;
        foreach ($data['modules'] as $i => $mod) {
            $module = LmsModule::query()->create([
                'course_id' => $run->course_id,
                'title' => $mod['title'],
                'description' => $mod['description'] ?? null,
                'objectives_json' => $mod['objectives'] ?? [],
                'competency_map_json' => $mod['mapped_competencies'] ?? [],
                'study_minutes' => $mod['study_minutes'] ?? null,
                'sort_order' => $i + 1,
            ]);
            $moduleCount++;
            foreach ($mod['lessons'] as $j => $lesson) {
                LmsLesson::query()->create([
                    'module_id' => $module->id,
                    'title' => $lesson['title'],
                    'lesson_type' => 'text',
                    'text_content' => '<p><em>Content generating…</em></p><p>'.e($lesson['outline'] ?? '').'</p>',
                    'objectives_json' => $lesson['objectives'] ?? [],
                    'sort_order' => $j + 1,
                    'ai_metadata_json' => ['outline' => $lesson['outline'] ?? '', 'status' => 'shell'],
                ]);
                $lessonCount++;
            }
            $this->events->write($run, 'module_started', 'Module planned', $mod['title'], 'OpenAI');
        }

        $run->update([
            'stats_json' => array_merge($run->stats_json ?? [], [
                'modules_planned' => $moduleCount,
                'lessons_planned' => $lessonCount,
                'coverage_matrix' => $data['coverage_matrix'] ?? [],
            ]),
            'provider_metadata' => array_merge($run->provider_metadata ?? [], ['architecture' => $data]),
        ]);

        return [
            'status' => 'completed',
            'generated_records_count' => $moduleCount + $lessonCount,
            'message' => "{$moduleCount} modules / {$lessonCount} lessons",
            'agent' => 'OpenAI',
        ];
    }

    private function lessonContent(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $batch = (int) config('course_factory.lesson_batch_size', 3);
        $lessons = LmsLesson::query()
            ->whereHas('module', fn ($q) => $q->where('course_id', $run->course_id))
            ->orderBy('id')
            ->get()
            ->filter(fn (LmsLesson $l) => ($l->ai_metadata_json['status'] ?? '') !== 'content_ready');

        $total = LmsLesson::query()->whereHas('module', fn ($q) => $q->where('course_id', $run->course_id))->count();
        $doneBefore = $total - $lessons->count();
        $slice = $lessons->take($batch);
        $sources = CfResearchSource::query()->where('generation_run_id', $run->id)->limit(40)->get(['title', 'url', 'organization', 'authority_tier']);

        foreach ($slice as $lesson) {
            $this->events->write($run, 'lesson_started', 'Writing lesson', $lesson->title, 'OpenAI — Lesson Writer');
            $result = $this->openai->structured(
                PromptCatalog::lessonSystem(),
                json_encode([
                    'lesson_title' => $lesson->title,
                    'objectives' => $lesson->objectives_json,
                    'outline' => $lesson->ai_metadata_json['outline'] ?? '',
                    'module' => $lesson->module?->title,
                    'sources' => $sources,
                    'exam' => $run->canonical_exam_name ?? $run->exam_name,
                ], JSON_PRETTY_PRINT),
                CourseFactorySchemas::lesson(),
                'lesson_content',
                (string) config('course_factory.openai.text_model')
            );
            $this->events->trackUsage($run, 'openai', $result['model'], $result['usage'], $step->id);
            $data = $result['data'];
            $lesson->update([
                'text_content' => $data['html_content'],
                'objectives_json' => $data['objectives'],
                'references_json' => $data['references'],
                'last_ai_verified_at' => now(),
                'ai_metadata_json' => array_merge($lesson->ai_metadata_json ?? [], [
                    'status' => 'content_ready',
                    'glossary' => $data['glossary'],
                    'exam_tips' => $data['exam_tips'],
                    'common_mistakes' => $data['common_mistakes'],
                    'needs_diagram' => $data['needs_diagram'],
                    'diagram_prompt' => $data['diagram_prompt'],
                    'prompt_version' => PromptCatalog::VERSION,
                ]),
            ]);
            $this->events->write($run, 'lesson_completed', 'Lesson generated', $lesson->title, 'OpenAI — Lesson Writer');
        }

        $remaining = LmsLesson::query()
            ->whereHas('module', fn ($q) => $q->where('course_id', $run->course_id))
            ->get()
            ->filter(fn (LmsLesson $l) => ($l->ai_metadata_json['status'] ?? '') !== 'content_ready')
            ->count();

        $done = $total - $remaining;
        $progress = $total > 0 ? (int) floor(($done / $total) * 100) : 100;

        if ($remaining > 0) {
            return [
                'status' => 'continue',
                'progress' => max(5, $progress),
                'generated_records_count' => $done,
                'message' => "Lessons {$done}/{$total}",
                'agent' => 'OpenAI — Lesson Writer',
            ];
        }

        return ['status' => 'completed', 'generated_records_count' => $done, 'agent' => 'OpenAI — Lesson Writer'];
    }

    private function lessonImages(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $candidates = LmsLesson::query()
            ->whereHas('module', fn ($q) => $q->where('course_id', $run->course_id))
            ->get()
            ->filter(fn (LmsLesson $l) => ! empty($l->ai_metadata_json['needs_diagram']) && empty($l->ai_metadata_json['diagram_url']))
            ->take(5);

        $count = 0;
        foreach ($candidates as $lesson) {
            $prompt = $lesson->ai_metadata_json['diagram_prompt'] ?? ('Educational diagram for '.$lesson->title);
            $image = $this->openai->generateImage($prompt.' — clean educational illustration, no logos.');
            $this->events->trackUsage($run, 'openai', $image['model'], [], $step->id, 1);
            $path = 'course-factory/'.$run->id.'/lesson-'.$lesson->id.'.png';
            $url = null;
            if (! empty($image['b64_json'])) {
                Storage::disk('public')->put($path, base64_decode($image['b64_json']));
                $url = rtrim((string) config('app.url'), '/').'/storage/'.$path;
            } elseif (! empty($image['url'])) {
                $bytes = Http::timeout(60)->get($image['url'])->body();
                if ($bytes !== '' && $bytes !== false) {
                    Storage::disk('public')->put($path, $bytes);
                    $url = rtrim((string) config('app.url'), '/').'/storage/'.$path;
                }
            }
            if ($url) {
                $html = $lesson->text_content.'<figure><img src="'.e($url).'" alt="'.e($lesson->title).' diagram" /><figcaption>'.e($lesson->title).'</figcaption></figure>';
                $lesson->update([
                    'text_content' => $html,
                    'ai_metadata_json' => array_merge($lesson->ai_metadata_json ?? [], ['diagram_url' => $url]),
                ]);
                $count++;
            }
        }

        return ['status' => 'completed', 'generated_records_count' => $count, 'agent' => 'OpenAI'];
    }

    private function lessonPractice(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $lessons = LmsLesson::query()->whereHas('module', fn ($q) => $q->where('course_id', $run->course_id))->orderBy('id')->get();
        $cursor = (int) ($step->metadata['lesson_cursor'] ?? 0);
        if ($cursor >= $lessons->count()) {
            return ['status' => 'completed', 'generated_records_count' => (int) ($step->generated_records_count ?? 0), 'agent' => 'OpenAI'];
        }

        $lesson = $lessons[$cursor];
        $created = $this->generateQuestionBatch($run, $step, [
            'purpose' => 'lesson_practice',
            'count' => 5,
            'lesson_id' => $lesson->id,
            'module_id' => $lesson->module_id,
            'topic' => $lesson->title,
            'context' => Str::limit(strip_tags((string) $lesson->text_content), 4000),
        ]);

        $next = $cursor + 1;
        $progress = (int) floor(($next / max(1, $lessons->count())) * 100);

        return [
            'status' => $next >= $lessons->count() ? 'completed' : 'continue',
            'progress' => $progress,
            'generated_records_count' => (int) $step->generated_records_count + $created,
            'metadata' => ['lesson_cursor' => $next],
            'agent' => 'OpenAI',
            'message' => "Practice for {$lesson->title}",
        ];
    }

    private function moduleQuizzes(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $modules = LmsModule::query()->where('course_id', $run->course_id)->orderBy('sort_order')->get();
        foreach ($modules as $module) {
            $quiz = LmsQuiz::query()->updateOrCreate(
                [
                    'course_id' => $run->course_id,
                    'module_id' => $module->id,
                    'title' => $module->title.' — Module Quiz',
                ],
                [
                    'content_type' => 'mixed',
                    'source_mode' => 'question_bank',
                    'random_question_count' => 15,
                    'time_limit_minutes' => 25,
                    'description' => 'Module-level assessment using exam-style practice questions.',
                    'passing_score' => 70,
                    'sort_order' => $module->sort_order,
                ]
            );

            $bankIds = LmsQuestionBank::query()
                ->where('course_id', $run->course_id)
                ->where('module_id', $module->id)
                ->limit(20)
                ->pluck('id');

            if ($bankIds->isEmpty()) {
                $this->generateQuestionBatch($run, $step, [
                    'purpose' => 'module_quiz',
                    'count' => 10,
                    'module_id' => $module->id,
                    'topic' => $module->title,
                    'context' => $module->description,
                ]);
                $bankIds = LmsQuestionBank::query()
                    ->where('course_id', $run->course_id)
                    ->where('module_id', $module->id)
                    ->limit(20)
                    ->pluck('id');
            }

            foreach ($bankIds as $i => $qid) {
                LmsQuizBankQuestion::query()->firstOrCreate(
                    ['quiz_id' => $quiz->id, 'bank_question_id' => $qid],
                    ['sort_order' => $i + 1]
                );
            }
        }

        return ['status' => 'completed', 'generated_records_count' => $modules->count(), 'agent' => 'OpenAI'];
    }

    private function assignments(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $modules = LmsModule::query()->where('course_id', $run->course_id)->get(['id', 'title', 'description', 'competency_map_json']);
        $result = $this->openai->structured(
            'Create meaningful professional exam-prep assignments/activities. Skip filler.',
            json_encode(['exam' => $run->canonical_exam_name, 'modules' => $modules], JSON_PRETTY_PRINT),
            CourseFactorySchemas::assignmentBatch(),
            'assignments',
            (string) config('course_factory.openai.text_model')
        );
        $this->events->trackUsage($run, 'openai', $result['model'], $result['usage'], $step->id);
        $count = 0;
        foreach ($result['data']['assignments'] as $i => $a) {
            $module = $modules->first(fn ($m) => strcasecmp($m->title, $a['module_title']) === 0) ?? $modules->first();
            LmsHomework::query()->create([
                'course_id' => $run->course_id,
                'module_id' => $module?->id,
                'title' => $a['title'],
                'instructions' => "<p><strong>Objective:</strong> {$a['objective']}</p><p>{$a['instructions']}</p><p><strong>Expected outcome:</strong> {$a['expected_outcome']}</p><p><strong>Evaluation:</strong> {$a['evaluation_guidance']}</p>",
                'max_score' => 100,
                'sort_order' => $i + 1,
            ]);
            $count++;
        }

        return ['status' => 'completed', 'generated_records_count' => $count, 'agent' => 'OpenAI'];
    }

    private function questionBank(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $bp = CfExamBlueprint::query()->where('generation_run_id', $run->id)->first();
        $examCount = (int) ($bp?->question_count ?: 100);
        $target = (int) max(
            (int) config('course_factory.question_bank.min_size', 500),
            min(
                (int) config('course_factory.question_bank.max_size', 2000),
                (int) round($examCount * (float) config('course_factory.question_bank.multiplier', 5))
            )
        );

        $existing = LmsQuestionBank::query()->where('course_id', $run->course_id)->where('generation_run_id', $run->id)->count();
        if ($existing >= $target) {
            $run->update(['stats_json' => array_merge($run->stats_json ?? [], ['question_bank_target' => $target, 'question_bank_generated' => $existing])]);

            return ['status' => 'completed', 'generated_records_count' => $existing, 'agent' => 'OpenAI'];
        }

        $batch = (int) config('course_factory.question_bank.batch_size', 20);
        $need = min($batch, $target - $existing);
        $domains = $bp?->domains ?? [];
        $domain = $domains[array_rand($domains)] ?? ['name' => 'General', 'competencies' => []];
        $created = $this->generateQuestionBatch($run, $step, [
            'purpose' => 'master_bank',
            'count' => $need,
            'topic' => $domain['name'] ?? 'General',
            'domain' => $domain['name'] ?? 'General',
            'competency' => ($domain['competencies'][0] ?? 'Core competency'),
            'model' => (string) config('course_factory.openai.text_model'),
            'context' => json_encode([
                'exam' => $run->canonical_exam_name ?? $run->exam_name,
                'domain' => $domain,
                'source_titles' => CfResearchSource::query()->where('generation_run_id', $run->id)->limit(12)->pluck('title'),
            ]),
        ]);

        $now = $existing + $created;
        $run->update(['stats_json' => array_merge($run->stats_json ?? [], [
            'question_bank_target' => $target,
            'question_bank_generated' => $now,
        ])]);
        $this->events->write($run, 'questions_batch_completed', 'Question bank batch', "{$now}/{$target}", 'OpenAI');

        if ($now < $target) {
            return [
                'status' => 'continue',
                'progress' => (int) floor(($now / $target) * 100),
                'generated_records_count' => $now,
                'message' => "Question Bank {$now}/{$target}",
                'agent' => 'OpenAI',
            ];
        }

        return ['status' => 'completed', 'generated_records_count' => $now, 'agent' => 'OpenAI'];
    }

    private function caseBank(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $bp = CfExamBlueprint::query()->where('generation_run_id', $run->id)->first();
        if (! ($bp?->has_case_questions)) {
            return ['status' => 'completed', 'generated_records_count' => 0, 'message' => 'No case-based format detected', 'agent' => 'Orchestrator'];
        }

        $result = $this->openai->structured(
            'Create original case-bank scenarios for exam-style practice. Not real confidential cases.',
            json_encode(['exam' => $run->canonical_exam_name, 'domains' => $bp->domains], JSON_PRETTY_PRINT),
            CourseFactorySchemas::caseBatch(),
            'case_bank',
            (string) config('course_factory.openai.reasoning_model')
        );
        $this->events->trackUsage($run, 'openai', $result['model'], $result['usage'], $step->id);
        $count = 0;
        foreach ($result['data']['cases'] as $i => $case) {
            CfCaseBank::query()->create([
                'generation_run_id' => $run->id,
                'course_id' => $run->course_id,
                'case_key' => 'CASE-'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT),
                'title' => $case['title'],
                'profile_json' => ['summary' => $case['profile']],
                'timeline_json' => $case['timeline'],
                'facts_json' => $case['facts'],
                'issues_json' => [
                    'legal' => $case['legal_issues'],
                    'ethical' => $case['ethical_issues'],
                ],
                'question_ids' => [],
                'status' => 'draft',
            ]);
            $count++;
        }

        return ['status' => 'completed', 'generated_records_count' => $count, 'agent' => 'OpenAI'];
    }

    private function mockExam(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $bp = CfExamBlueprint::query()->where('generation_run_id', $run->id)->firstOrFail();
        $research = $this->unwrapStructuredPayload($run->research_json ?? []);

        // Prefer verified blueprint values; fall back to research dossier; never insert NULL into NOT NULL LMS columns.
        $qCount = $bp->question_count
            ?? (isset($research['question_count']) ? (int) $research['question_count'] : null);
        $duration = $bp->duration_minutes
            ?? (isset($research['duration_minutes']) ? (int) $research['duration_minutes'] : null);

        $quizQuestionCount = $qCount ?: 100;
        $quizDuration = $duration ?: 180;
        $passingScore = 70;
        $unknownOfficialCounts = $qCount === null || $duration === null;

        $weights = [];
        foreach ($bp->domains ?? [] as $d) {
            $weights[] = [
                'domain' => $d['name'] ?? 'Unknown',
                'weight_percent' => $d['weight_percent'] ?? null,
            ];
        }

        CfMockExamBlueprint::query()->updateOrCreate(
            ['generation_run_id' => $run->id],
            [
                'course_id' => $run->course_id,
                'question_count' => $qCount,
                'duration_minutes' => $duration,
                'domain_weights' => $weights,
                'difficulty_mix' => config('course_factory.difficulty_distribution'),
                'question_type_mix' => $bp->question_formats,
                'rules_json' => [
                    'mode' => 'strict_simulation',
                    'randomize_questions' => true,
                    'shuffle_options' => true,
                    'immediate_feedback' => false,
                    'show_explanations_before_submit' => false,
                    'flag_for_review' => true,
                    'navigator' => true,
                    'auto_submit_on_timeout' => true,
                    'pause_allowed' => false,
                    'labeling' => 'Exam-style practice questions / Realistic exam simulation',
                    'not' => 'Actual exam questions',
                    'dynamic_selection' => true,
                    'freeze_attempt_snapshot' => true,
                    'runtime_defaults' => [
                        'question_count' => $quizQuestionCount,
                        'duration_minutes' => $quizDuration,
                        'passing_score' => $passingScore,
                        'official_counts_unknown' => $unknownOfficialCounts,
                    ],
                ],
                'strict_simulation' => true,
                'status' => 'configured',
            ]
        );

        // Practice/mock quiz shell — LMS schema requires non-null passing_score.
        LmsQuiz::query()->updateOrCreate(
            ['course_id' => $run->course_id, 'title' => 'Dynamic Mock Exam Engine'],
            [
                'module_id' => null,
                'content_type' => 'mock',
                'source_mode' => 'dynamic_bank',
                'random_question_count' => $quizQuestionCount,
                'time_limit_minutes' => $quizDuration,
                'description' => $unknownOfficialCounts
                    ? 'Dynamic mock exam configured from researched exam blueprint. Official question count/duration were unknown — provisional defaults applied for admin review. Uses original question bank only.'
                    : 'Dynamic mock exam configured from researched exam blueprint. Uses original question bank only.',
                'passing_score' => $passingScore,
                'sort_order' => 999,
            ]
        );

        $this->events->write(
            $run,
            'mock_blueprint_completed',
            'Mock exam configured',
            $unknownOfficialCounts
                ? "Provisional {$quizQuestionCount}Q / {$quizDuration}m (official counts unknown — admin review required)"
                : "{$quizQuestionCount} questions / {$quizDuration} minutes",
            'Orchestrator'
        );

        return ['status' => 'completed', 'generated_records_count' => 1, 'agent' => 'Orchestrator'];
    }

    private function answerValidation(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $pending = LmsQuestionBank::query()
            ->where('course_id', $run->course_id)
            ->where('generation_run_id', $run->id)
            ->where(function ($q) {
                $q->whereNull('verification_status')->orWhere('verification_status', 'pending');
            })
            ->with('options')
            ->orderBy('id')
            ->limit(15)
            ->get();

        if ($pending->isEmpty()) {
            $verified = LmsQuestionBank::query()->where('course_id', $run->course_id)->where('verification_status', 'ai_verified')->count();

            return ['status' => 'completed', 'generated_records_count' => $verified, 'agent' => 'OpenAI'];
        }

        foreach ($pending as $q) {
            $payload = [
                'stem' => $q->question_text,
                'options' => $q->options->pluck('option_text')->values(),
                'correct_index' => $q->options->search(fn ($o) => (bool) $o->is_correct),
                'explanation' => $q->explanation,
                'sources' => $q->source_references_json,
                'competency' => $q->competency,
            ];
            $result = $this->openai->structured(
                PromptCatalog::validationSystem(),
                json_encode($payload, JSON_PRETTY_PRINT),
                CourseFactorySchemas::questionValidation(),
                'question_validation',
                (string) config('course_factory.openai.reasoning_model')
            );
            $this->events->trackUsage($run, 'openai', $result['model'], $result['usage'], $step->id);
            $data = $result['data'];
            CfContentValidation::query()->create([
                'generation_run_id' => $run->id,
                'target_type' => 'question',
                'target_id' => $q->id,
                'validator' => 'openai',
                'status' => ($data['accepted'] ?? false) ? 'passed' : 'failed',
                'result_json' => $data,
            ]);

            if ($data['accepted'] ?? false) {
                $q->update([
                    'verification_status' => 'ai_verified',
                    'status' => 'ai_verified',
                    'last_verified_at' => now(),
                ]);
            } else {
                $q->update([
                    'verification_status' => 'rejected',
                    'status' => 'retired',
                ]);
                // regenerate replacement
                $this->generateQuestionBatch($run, $step, [
                    'purpose' => 'replacement',
                    'count' => 1,
                    'topic' => $q->topic,
                    'domain' => $q->domain,
                    'competency' => $q->competency,
                    'module_id' => $q->module_id,
                    'lesson_id' => $q->lesson_id,
                    'context' => 'Replace rejected question. Issues: '.implode('; ', $data['issues'] ?? []),
                ]);
            }
        }

        $left = LmsQuestionBank::query()
            ->where('course_id', $run->course_id)
            ->where('generation_run_id', $run->id)
            ->where(function ($q) {
                $q->whereNull('verification_status')->orWhere('verification_status', 'pending');
            })->count();

        $done = LmsQuestionBank::query()->where('course_id', $run->course_id)->where('generation_run_id', $run->id)->where('verification_status', 'ai_verified')->count();
        $total = max(1, LmsQuestionBank::query()->where('course_id', $run->course_id)->where('generation_run_id', $run->id)->count());

        if ($left > 0) {
            return [
                'status' => 'continue',
                'progress' => (int) floor(($done / $total) * 100),
                'generated_records_count' => $done,
                'message' => "Validated {$done}, remaining {$left}",
                'agent' => 'OpenAI',
            ];
        }

        return ['status' => 'completed', 'generated_records_count' => $done, 'agent' => 'OpenAI'];
    }

    private function manusFactualValidation(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $meta = $step->metadata ?? [];
        if (! empty($meta['task_id']) && empty($meta['done'])) {
            return [
                'status' => 'waiting_external',
                'external_provider' => 'manus',
                'external_task_id' => $meta['task_id'],
                'metadata' => $meta,
            ];
        }

        $percent = (float) config('course_factory.manus_factual_sample_percent', 8);
        $totalVerified = LmsQuestionBank::query()
            ->where('course_id', $run->course_id)
            ->where('verification_status', 'ai_verified')
            ->count();

        // Manus v2 user message limit ~5000 estimated tokens — keep samples tiny.
        $targetSample = min(12, max(3, (int) ceil($totalVerified * ($percent / 100))));
        $checkedIds = collect($meta['checked_ids'] ?? [])->map(fn ($id) => (int) $id)->all();
        $batchSize = 4;

        if (count($checkedIds) >= $targetSample) {
            return [
                'status' => 'completed',
                'generated_records_count' => count($checkedIds),
                'message' => 'Factual sample complete ('.count($checkedIds).'/'.$targetSample.')',
                'agent' => 'Manus',
                'metadata' => array_merge($meta, ['done' => true]),
            ];
        }

        $questions = LmsQuestionBank::query()
            ->where('course_id', $run->course_id)
            ->where('verification_status', 'ai_verified')
            ->when($checkedIds !== [], fn ($q) => $q->whereNotIn('id', $checkedIds))
            ->inRandomOrder()
            ->limit($batchSize)
            ->get(['id', 'question_text', 'explanation', 'competency', 'domain']);

        if ($questions->isEmpty()) {
            return [
                'status' => 'completed',
                'generated_records_count' => count($checkedIds),
                'message' => 'No more questions available for factual sampling',
                'agent' => 'Manus',
                'metadata' => array_merge($meta, ['done' => true]),
            ];
        }

        $compact = $questions->map(fn (LmsQuestionBank $q) => [
            'id' => $q->id,
            'competency' => Str::limit((string) $q->competency, 80, ''),
            'domain' => Str::limit((string) $q->domain, 80, ''),
            'stem' => Str::limit(trim(strip_tags((string) $q->question_text)), 220, ''),
            'claim' => Str::limit(trim(strip_tags((string) $q->explanation)), 160, ''),
        ])->values()->all();

        $prompt = <<<TXT
Fact-check ONLY these Canadian exam-prep legal/regulatory claims against current public Tier-1/Tier-2 sources (CICC, IRCC, Justice Laws, IRB).
Return structured results for each id. Be concise. Do not ask questions.

Items:
TXT;
        $prompt .= json_encode($compact, JSON_UNESCAPED_SLASHES);

        // Soft guard for Manus ~5k token input limit (~4 chars/token rough estimate).
        if (strlen($prompt) > 14000) {
            $compact = array_slice($compact, 0, 2);
            $prompt = "Fact-check ONLY these Canadian exam-prep legal/regulatory claims against current public Tier-1/Tier-2 sources. Return structured results for each id.\n"
                .json_encode($compact, JSON_UNESCAPED_SLASHES);
        }

        $created = $this->manus->createTask($prompt, [
            'type' => 'object',
            'properties' => [
                'results' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'id' => ['type' => 'integer'],
                            'passed' => ['type' => 'boolean'],
                            'notes' => ['type' => 'string'],
                        ],
                        'required' => ['id', 'passed', 'notes'],
                        'additionalProperties' => false,
                    ],
                ],
            ],
            'required' => ['results'],
            'additionalProperties' => false,
        ], 'Course Factory factual sample: '.$run->exam_name);

        $this->events->trackUsage($run, 'manus', 'manus-v2', [], $step->id, 0, 1);
        $this->events->write(
            $run,
            'validation_started',
            'Manus factual sample batch',
            'Checking '.count($compact).' questions ('.count($checkedIds).'/'.$targetSample.' sampled)',
            'Manus'
        );

        return [
            'status' => 'waiting_external',
            'external_provider' => 'manus',
            'external_task_id' => $created['task_id'] ?? null,
            'metadata' => [
                'task_id' => $created['task_id'] ?? null,
                'done' => false,
                'batch_ids' => collect($compact)->pluck('id')->all(),
                'checked_ids' => $checkedIds,
                'target_sample' => $targetSample,
            ],
            'agent' => 'Manus',
        ];
    }

    private function coverageAudit(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $stats = [
            'modules' => LmsModule::query()->where('course_id', $run->course_id)->count(),
            'lessons' => LmsLesson::query()->whereHas('module', fn ($q) => $q->where('course_id', $run->course_id))->count(),
            'lessons_ready' => LmsLesson::query()->whereHas('module', fn ($q) => $q->where('course_id', $run->course_id))->get()
                ->filter(fn ($l) => ($l->ai_metadata_json['status'] ?? '') === 'content_ready')->count(),
            'questions' => LmsQuestionBank::query()->where('course_id', $run->course_id)->count(),
            'verified_questions' => LmsQuestionBank::query()->where('course_id', $run->course_id)->where('verification_status', 'ai_verified')->count(),
            'quizzes' => LmsQuiz::query()->where('course_id', $run->course_id)->count(),
            'assignments' => LmsHomework::query()->where('course_id', $run->course_id)->count(),
            'sources' => CfResearchSource::query()->where('generation_run_id', $run->id)->count(),
            'thumbnail' => (bool) LmsCourse::query()->where('id', $run->course_id)->value('thumbnail_url'),
            'mock' => CfMockExamBlueprint::query()->where('generation_run_id', $run->id)->exists(),
            'target_bank' => (int) (($run->stats_json['question_bank_target'] ?? 0)),
        ];

        $result = $this->openai->structured(
            PromptCatalog::coverageSystem(),
            json_encode([
                'stats' => $stats,
                'blueprint' => CfExamBlueprint::query()->where('generation_run_id', $run->id)->first(),
                'matrix' => $run->stats_json['coverage_matrix'] ?? [],
            ], JSON_PRETTY_PRINT),
            CourseFactorySchemas::coverageAudit(),
            'coverage_audit',
            (string) config('course_factory.openai.reasoning_model')
        );
        $this->events->trackUsage($run, 'openai', $result['model'], $result['usage'], $step->id);
        $data = $result['data'];
        $run->update(['coverage_report_json' => array_merge($data, ['stats' => $stats])]);

        if (! ($data['passed'] ?? false)) {
            $run->update(['status' => 'generation_incomplete', 'error_summary' => implode('; ', $data['blocking_gaps'] ?? ['Coverage gaps'])]);
            throw new \RuntimeException('Coverage audit failed: '.implode('; ', $data['blocking_gaps'] ?? []));
        }

        return ['status' => 'completed', 'agent' => 'OpenAI', 'message' => 'Coverage audit passed', 'metadata' => $data];
    }

    private function completenessGate(CfGenerationRun $run, CfGenerationStep $step): array
    {
        $course = LmsCourse::query()->findOrFail($run->course_id);
        $checks = [
            'metadata' => filled($course->title) && filled($course->description),
            'thumbnail' => filled($course->thumbnail_url),
            'research' => ! empty($run->research_json),
            'sources' => CfResearchSource::query()->where('generation_run_id', $run->id)->exists(),
            'blueprint' => CfExamBlueprint::query()->where('generation_run_id', $run->id)->exists(),
            'modules' => LmsModule::query()->where('course_id', $run->course_id)->exists(),
            'lessons' => LmsLesson::query()->whereHas('module', fn ($q) => $q->where('course_id', $run->course_id))->exists(),
            'lesson_content' => LmsLesson::query()->whereHas('module', fn ($q) => $q->where('course_id', $run->course_id))->get()
                ->every(fn ($l) => ($l->ai_metadata_json['status'] ?? '') === 'content_ready'),
            'quizzes' => LmsQuiz::query()->where('course_id', $run->course_id)->exists(),
            'question_bank' => LmsQuestionBank::query()->where('course_id', $run->course_id)->count() >= (int) (($run->stats_json['question_bank_target'] ?? 1)),
            'validation' => LmsQuestionBank::query()->where('course_id', $run->course_id)->whereNull('verification_status')->doesntExist(),
            'mock' => CfMockExamBlueprint::query()->where('generation_run_id', $run->id)->exists(),
            'coverage' => (bool) (($run->coverage_report_json['passed'] ?? false)),
        ];

        $failed = collect($checks)->filter(fn ($ok) => ! $ok)->keys()->values()->all();
        if ($failed) {
            $run->update([
                'status' => 'generation_incomplete',
                'error_summary' => 'Completeness gate failed: '.implode(', ', $failed),
            ]);
            throw new \RuntimeException('Completeness gate failed: '.implode(', ', $failed));
        }

        $course->update(['review_status' => 'pending_review', 'is_published' => false]);
        $this->events->write($run, 'final_assembly_completed', 'Completeness gate passed', 'Course moved to pending admin review.', 'Orchestrator');

        return ['status' => 'completed', 'agent' => 'Orchestrator', 'metadata' => ['checks' => $checks]];
    }

    /** @param array<string, mixed> $opts */
    private function generateQuestionBatch(CfGenerationRun $run, CfGenerationStep $step, array $opts): int
    {
        $count = (int) ($opts['count'] ?? 10);
        $dist = config('course_factory.difficulty_distribution');
        $result = $this->openai->structured(
            PromptCatalog::questionSystem(),
            json_encode([
                'exam' => $run->canonical_exam_name ?? $run->exam_name,
                'count' => $count,
                'purpose' => $opts['purpose'] ?? 'bank',
                'topic' => $opts['topic'] ?? null,
                'domain' => $opts['domain'] ?? null,
                'competency' => $opts['competency'] ?? null,
                'difficulty_distribution' => $dist,
                'context' => $opts['context'] ?? null,
                'disclaimer' => 'Generate ORIGINAL exam-style practice questions only.',
            ], JSON_PRETTY_PRINT),
            CourseFactorySchemas::questionsBatch(),
            'questions_batch',
            (string) ($opts['model'] ?? config('course_factory.openai.text_model'))
        );
        $this->events->trackUsage($run, 'openai', $result['model'], $result['usage'], $step->id);

        $created = 0;
        foreach ($result['data']['questions'] as $i => $q) {
            $hash = hash('sha256', Str::lower(preg_replace('/\s+/', ' ', trim($q['stem']))));
            if (LmsQuestionBank::query()->where('course_id', $run->course_id)->where('content_hash', $hash)->exists()) {
                continue;
            }
            $bank = LmsQuestionBank::query()->create([
                'course_id' => $run->course_id,
                'module_id' => $opts['module_id'] ?? null,
                'lesson_id' => $opts['lesson_id'] ?? null,
                'question_text' => $q['stem'],
                'topic' => $q['topic'],
                'subtopic' => $q['subtopic'],
                'difficulty' => $q['difficulty'],
                'explanation' => $q['explanation'],
                'competency' => $q['competency'],
                'domain' => $q['domain'],
                'question_type' => $q['question_type'],
                'status' => 'draft',
                'distractor_explanations_json' => $q['distractor_explanations'],
                'source_references_json' => $q['source_references'],
                'generation_run_id' => $run->id,
                'content_hash' => $hash,
                'verification_status' => 'pending',
                'ai_metadata_json' => [
                    'provider' => 'openai',
                    'model' => $result['model'],
                    'prompt_version' => PromptCatalog::VERSION,
                    'purpose' => $opts['purpose'] ?? null,
                ],
                'sort_order' => $i + 1,
            ]);
            foreach ($q['options'] as $oi => $opt) {
                LmsQuestionBankOption::query()->create([
                    'bank_question_id' => $bank->id,
                    'option_text' => $opt,
                    'is_correct' => $oi === (int) $q['correct_index'],
                    'sort_order' => $oi + 1,
                ]);
            }
            $created++;
        }

        return $created;
    }

    private function manusResearchPrompt(string $examName, array $discovery): string
    {
        $json = json_encode($discovery, JSON_PRETTY_PRINT);

        return <<<TXT
Perform deep research on the Canadian professional/licensing exam: {$examName}

Discovery context:
{$json}

Research and return structured findings for:
- official regulator
- official candidate handbook
- eligibility context
- exam objectives
- competency blueprint / domains with published weighting when available
- question types, question count, duration, delivery format, open/closed book
- legislation, regulations, ethical/professional standards
- authoritative source URLs with organization, type, authority tier (1=legislation/regulator/government/court, 2=official institutional guidance, 3=secondary)
- knowledge cut-off notes
- unknown fields that cannot be established from public authoritative sources

Do NOT invent official numbers. Do NOT use blogs as primary legal authority.
Do NOT seek confidential/leaked exam questions.
TXT;
    }

    private function nullableDate(mixed $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }
        try {
            return \Carbon\Carbon::parse($value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }
}

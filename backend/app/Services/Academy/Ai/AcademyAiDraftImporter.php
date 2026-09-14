<?php

namespace App\Services\Academy\Ai;

use App\Models\Academy\AcademyAiGeneratedItem;
use App\Models\Academy\AcademyAiGenerationJob;
use App\Models\Academy\AcademyCase;
use App\Models\Academy\AcademyCaseExhibit;
use App\Models\Academy\AcademyCaseVersion;
use App\Models\Academy\AcademyCompetency;
use App\Models\Academy\AcademyContentSourceLink;
use App\Models\Academy\AcademyCourse;
use App\Models\Academy\AcademyCourseVersion;
use App\Models\Academy\AcademyLesson;
use App\Models\Academy\AcademyModule;
use App\Models\Academy\AcademyQuestion;
use App\Models\Academy\AcademyQuestionVersion;
use App\Models\Academy\AcademyTopic;
use App\Models\User;
use App\Services\Academy\AcademyCourseService;
use App\Services\Academy\AcademyQuestionService;
use Illuminate\Support\Str;

class AcademyAiDraftImporter
{
    public function __construct(
        private AcademyCourseService $courses,
        private AcademyQuestionService $questions,
        private AcademyAiDuplicateDetector $duplicates,
    ) {}

    public function importCourseShell(AcademyAiGenerationJob $job, User $actor, array $blueprint): AcademyCourseVersion
    {
        $course = $job->course_id
            ? AcademyCourse::query()->findOrFail($job->course_id)
            : $this->courses->createDraft([
                'track_id' => $job->track_id,
                'title' => $blueprint['title'] ?? $job->title,
                'description' => $blueprint['goal'] ?? $job->goal,
                'difficulty' => $job->difficulty ?? 'intermediate',
                'estimated_hours' => $job->estimated_hours,
            ], $actor);

        $version = $this->courses->draftVersionForEdit($course, $actor);
        $this->stamp($version, $job, AcademyAiPromptCatalog::version('course_blueprint'));
        $version->update([
            'title' => $blueprint['title'] ?? $version->title,
            'description' => $blueprint['goal'] ?? $version->description,
            'status' => 'draft',
        ]);
        AcademyAiGuard::assertDraftOnly((string) $version->status);

        $job->update(['course_id' => $course->id, 'course_version_id' => $version->id]);

        return $version->fresh('modules.lessons');
    }

    public function importLesson(AcademyAiGenerationJob $job, User $actor, AcademyAiGeneratedItem $item): AcademyLesson
    {
        $payload = $item->payload_json ?? [];
        $version = AcademyCourseVersion::query()->findOrFail($job->course_version_id);
        AcademyAiGuard::assertDraftOnly((string) $version->status);

        $moduleTitle = (string) ($payload['_module_title'] ?? 'Module');
        $module = $version->modules()->firstOrCreate(
            ['title' => $moduleTitle],
            ['sort_order' => (int) ($payload['_module_index'] ?? 0)]
        );

        $lesson = AcademyLesson::query()->create([
            'module_id' => $module->id,
            'title' => $payload['title'] ?? 'Lesson',
            'lesson_type' => 'rich_text',
            'body_html' => $this->lessonHtml($payload),
            'sort_order' => (int) ($payload['_lesson_index'] ?? 0),
            'generated_by_ai' => true,
            'ai_generation_job_id' => $job->id,
            'ai_prompt_version' => $item->prompt_version,
        ]);

        $item->update([
            'status' => 'draft_imported',
            'entity_type' => AcademyLesson::class,
            'entity_id' => $lesson->id,
        ]);

        return $lesson;
    }

    public function importQuestion(AcademyAiGenerationJob $job, User $actor, AcademyAiGeneratedItem $item, ?int $caseVersionId = null): ?AcademyQuestion
    {
        $payload = $item->payload_json ?? [];
        if ($dup = $this->duplicates->findDuplicate((string) ($payload['stem'] ?? ''))) {
            $item->update([
                'status' => 'likely_duplicate',
                'entity_type' => AcademyQuestionVersion::class,
                'entity_id' => $dup->id,
                'admin_label' => 'Review Recommended',
            ]);

            return null;
        }

        $unknown = [];
        $topicIds = $this->resolveKeys(AcademyTopic::class, $payload['topic_keys'] ?? [], $unknown);
        $competencyIds = $this->resolveKeys(AcademyCompetency::class, $payload['competency_keys'] ?? [], $unknown);
        if ($unknown) {
            $item->admin_label = trim(($item->admin_label ?: '').' unknown_taxonomy');
            $item->save();
        }

        $question = $this->questions->createDraft([
            'type' => $item->item_type === 'case_mcq' ? 'case_mcq' : 'independent_mcq',
            'question_text' => $payload['stem'],
            'explanation' => $payload['explanation'] ?? null,
            'difficulty' => $payload['difficulty'] ?? 'medium',
            'case_version_id' => $caseVersionId,
            'topic_ids' => $topicIds,
            'competency_ids' => $competencyIds,
            'options' => collect($payload['options'] ?? [])->map(fn ($o) => [
                'option_key' => $o['key'] ?? null,
                'option_text' => $o['text'] ?? '',
                'is_correct' => (bool) ($o['is_correct'] ?? false),
                'incorrect_explanation' => $o['incorrect_explanation'] ?? null,
            ])->all(),
        ], $actor);

        $version = $question->versions()->first();
        $this->stamp($version, $job, $item->prompt_version);
        AcademyAiGuard::assertDraftOnly((string) $version->status);

        $this->linkCitations($job, $version, $payload['citations'] ?? []);

        $item->update([
            'status' => 'draft_imported',
            'entity_type' => AcademyQuestion::class,
            'entity_id' => $question->id,
        ]);

        return $question;
    }

    public function importCase(AcademyAiGenerationJob $job, User $actor, AcademyAiGeneratedItem $item): AcademyCaseVersion
    {
        $payload = $item->payload_json ?? [];
        $case = AcademyCase::query()->create([
            'title' => $payload['title'] ?? 'Generated case',
            'slug' => Str::slug($payload['title'] ?? 'case').'-'.Str::lower(Str::random(5)),
            'track_id' => $job->track_id,
            'status' => 'draft',
            'created_by' => $actor->id,
        ]);
        $version = AcademyCaseVersion::query()->create([
            'case_id' => $case->id,
            'version_number' => 1,
            'facts' => $payload['facts'] ?? null,
            'immigration_history' => $payload['immigration_history'] ?? null,
            'procedural_history' => $payload['procedural_history'] ?? null,
            'tribunal_info' => $payload['tribunal_context'] ?? null,
            'legal_issues_json' => $payload['legal_issues'] ?? [],
            'status' => 'draft',
            'created_by' => $actor->id,
            'generated_by_ai' => true,
            'ai_generation_job_id' => $job->id,
            'ai_prompt_version' => $item->prompt_version,
        ]);
        AcademyAiGuard::assertDraftOnly((string) $version->status);

        foreach ($payload['exhibits'] ?? [] as $i => $exhibit) {
            AcademyCaseExhibit::query()->create([
                'case_version_id' => $version->id,
                'title' => $exhibit['title'] ?? 'Exhibit',
                'exhibit_type' => $exhibit['exhibit_type'] ?? 'other',
                'body_html' => $exhibit['body'] ?? null,
                'sort_order' => $i,
            ]);
        }

        $item->update([
            'status' => 'draft_imported',
            'entity_type' => AcademyCaseVersion::class,
            'entity_id' => $version->id,
        ]);

        return $version;
    }

    /**
     * @param  list<array<string, mixed>>  $citations
     */
    private function linkCitations(AcademyAiGenerationJob $job, AcademyQuestionVersion $version, array $citations): void
    {
        foreach ($citations as $cite) {
            $hint = mb_strtolower((string) ($cite['snapshot_hint'] ?? $cite['label'] ?? ''));
            $snapshot = $job->snapshots->first(function ($s) use ($hint) {
                return $hint !== '' && $hint !== 'none' && (
                    str_contains(mb_strtolower((string) $s->title), $hint)
                    || str_contains(mb_strtolower((string) $s->excerpt), $hint)
                );
            });
            if (! $snapshot?->legal_source_id) {
                continue;
            }
            AcademyContentSourceLink::query()->firstOrCreate([
                'legal_source_id' => $snapshot->legal_source_id,
                'linkable_type' => $version->getMorphClass(),
                'linkable_id' => $version->id,
                'section_label' => $cite['section'] ?? $cite['label'] ?? null,
            ]);
        }
    }

    /**
     * @param  list<string>  $keys
     * @param  list<string>  $unknown
     * @return list<int>
     */
    private function resolveKeys(string $model, array $keys, array &$unknown): array
    {
        $ids = [];
        foreach ($keys as $key) {
            $row = $model::query()->where('key', $key)->first();
            if ($row) {
                $ids[] = $row->id;
            } else {
                $unknown[] = $key;
            }
        }

        return $ids;
    }

    private function stamp($model, AcademyAiGenerationJob $job, ?string $promptVersion): void
    {
        if (method_exists($model, 'getConnectionName')) {
            $model->fill([
                'generated_by_ai' => true,
                'ai_generation_job_id' => $job->id,
                'ai_prompt_version' => $promptVersion,
            ]);
            if ($model->isFillable('status') || isset($model->status)) {
                $model->status = 'draft';
            }
            $model->save();
        }
    }

    /** @param array<string, mixed> $payload */
    private function lessonHtml(array $payload): string
    {
        $sections = [
            'Objectives' => implode('</li><li>', $payload['objectives'] ?? []),
            'Overview' => $payload['overview'] ?? '',
            'Key concepts' => implode('</li><li>', $payload['key_concepts'] ?? []),
            'Relevant law' => implode('</li><li>', $payload['relevant_law'] ?? []),
            'Practical interpretation' => $payload['practical_interpretation'] ?? '',
            'Exam-focused notes' => $payload['exam_notes'] ?? '',
            'Common mistakes' => implode('</li><li>', $payload['common_mistakes'] ?? []),
            'Worked example' => $payload['worked_example'] ?? '',
            'Takeaways' => implode('</li><li>', $payload['takeaways'] ?? []),
        ];
        $html = '';
        foreach ($sections as $heading => $body) {
            $html .= '<h2>'.e($heading).'</h2>';
            $html .= str_contains((string) $body, '</li>')
                ? '<ul><li>'.$body.'</li></ul>'
                : '<p>'.e((string) $body).'</p>';
        }

        return $html;
    }

    public function publishGenerated(): never
    {
        AcademyAiGuard::denyPublish();
    }
}

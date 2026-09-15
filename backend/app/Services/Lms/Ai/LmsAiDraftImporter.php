<?php

namespace App\Services\Lms\Ai;

use App\Models\Lms\LmsAiGeneratedItem;
use App\Models\Lms\LmsAiGenerationJob;
use App\Models\Lms\LmsCategory;
use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsCourseQuestion;
use App\Models\Lms\LmsExam;
use App\Models\Lms\LmsExamQuestion;
use App\Models\Lms\LmsExamQuestionOption;
use App\Models\Lms\LmsExamQuestionVersion;
use App\Models\Lms\LmsExamTemplate;
use App\Models\Lms\LmsLesson;
use App\Models\Lms\LmsModule;
use App\Models\User;
use App\Services\Academy\Ai\Exceptions\AcademyAiException;
use Illuminate\Support\Str;

class LmsAiDraftImporter
{
    public function importCourseDraft(LmsAiGenerationJob $job, User $actor, array $blueprint): LmsCourse
    {
        if ($job->course_id) {
            $course = LmsCourse::query()->findOrFail($job->course_id);
            LmsAiGuard::assertDraftOnly((string) $course->review_status, (bool) $course->is_published);

            return $course;
        }

        $existing = LmsCourse::query()->where('generation_job_id', $job->id)->first();
        if ($existing) {
            $job->update(['course_id' => $existing->id]);
            LmsAiGuard::assertDraftOnly((string) $existing->review_status, (bool) $existing->is_published);

            return $existing;
        }

        $profile = (string) $job->generation_profile;
        $category = $this->categoryForProfile($profile);
        $title = (string) ($blueprint['title'] ?? $job->title ?? 'LMS draft course');
        $language = (string) ($job->content_language ?: 'en');
        $review = $this->reviewStatusForLanguage($language);

        $course = LmsCourse::query()->create([
            'category_id' => $category->id,
            'title' => $title,
            'slug' => Str::slug($title).'-job-'.$job->id,
            'description' => $blueprint['goal'] ?? $job->goal,
            'is_published' => false,
            'exam_id' => $job->exam_id,
            'content_language' => $language,
            'review_status' => $review,
            'access_mode' => 'self_purchase',
            'generation_job_id' => $job->id,
        ]);
        LmsAiGuard::assertDraftOnly((string) $course->review_status, (bool) $course->is_published);
        $job->update(['course_id' => $course->id]);

        return $course->fresh();
    }

    public function importLesson(LmsAiGenerationJob $job, User $actor, LmsAiGeneratedItem $item): LmsLesson
    {
        if ($item->status === 'draft_imported' && $item->entity_id) {
            return LmsLesson::query()->findOrFail($item->entity_id);
        }

        $course = LmsCourse::query()->findOrFail($job->course_id);
        LmsAiGuard::assertDraftOnly((string) $course->review_status, (bool) $course->is_published);

        $payload = $item->payload_json ?? [];
        $moduleTitle = (string) ($payload['_module_title'] ?? 'Module');
        $module = LmsModule::query()->firstOrCreate(
            [
                'course_id' => $course->id,
                'title' => $moduleTitle,
            ],
            ['sort_order' => (int) ($payload['_module_index'] ?? 0)]
        );

        $lesson = LmsLesson::query()->create([
            'module_id' => $module->id,
            'title' => $payload['title'] ?? 'Lesson',
            'lesson_type' => 'text',
            'text_content' => $this->lessonHtml($payload),
            'sort_order' => (int) ($payload['_lesson_index'] ?? 0),
            'evidence_mapping_json' => [
                'generation_job_id' => $job->id,
                'exam_id' => $job->exam_id,
                'generation_profile' => $job->generation_profile,
                'evidence_pack_id' => $job->evidence_pack_id,
                'source_refs' => $payload['source_refs'] ?? [],
            ],
        ]);

        $item->update([
            'status' => 'draft_imported',
            'entity_type' => LmsLesson::class,
            'entity_id' => $lesson->id,
        ]);

        return $lesson;
    }

    public function importQuestion(LmsAiGenerationJob $job, User $actor, LmsAiGeneratedItem $item): ?LmsExamQuestion
    {
        if ($item->status === 'draft_imported' && $item->entity_id) {
            $question = LmsExamQuestion::query()->find($item->entity_id);
            if ($question) {
                $this->linkCourseQuestion($job, $question, $item);

                return $question;
            }
        }

        $payload = $item->payload_json ?? [];
        $practice = (bool) ($payload['practice_eligible'] ?? true);
        $mock = (bool) ($payload['mock_eligible'] ?? true);

        $question = LmsExamQuestion::query()->create([
            'exam_id' => $job->exam_id,
            'type' => 'independent_mcq',
            'status' => 'draft',
            'generation_job_id' => $job->id,
            'generation_profile' => $job->generation_profile,
            'style_pattern_category' => $payload['style_pattern_category'] ?? 'practice_mcq',
            'practice_eligible' => $practice,
            'mock_eligible' => $mock,
            'content_language' => $job->content_language ?: 'en',
            'created_by' => $actor->id,
        ]);

        $version = LmsExamQuestionVersion::query()->create([
            'question_id' => $question->id,
            'version_number' => 1,
            'question_text' => $payload['stem'] ?? 'Question',
            'explanation' => $payload['explanation'] ?? null,
            'difficulty' => $payload['difficulty'] ?? 'medium',
            'status' => 'draft',
            'provenance_json' => [
                'generation_job_id' => $job->id,
                'exam_id' => $job->exam_id,
                'generation_profile' => $job->generation_profile,
                'evidence_pack_id' => $job->evidence_pack_id,
                'item_id' => $item->id,
            ],
            'evidence_item_ids_json' => $job->snapshots()->where('authoritative', true)->pluck('evidence_item_id')->filter()->values()->all(),
            'topics_json' => $payload['topic_keys'] ?? [],
            'competencies_json' => $payload['competency_keys'] ?? [],
            'created_by' => $actor->id,
        ]);

        foreach ($payload['options'] ?? [] as $i => $option) {
            LmsExamQuestionOption::query()->create([
                'question_version_id' => $version->id,
                'option_key' => $option['key'] ?? chr(65 + $i),
                'option_text' => $option['text'] ?? '',
                'is_correct' => (bool) ($option['is_correct'] ?? false),
                'incorrect_explanation' => $option['incorrect_explanation'] ?? null,
                'sort_order' => $i,
            ]);
        }

        $this->linkCourseQuestion($job, $question, $item);

        $item->update([
            'status' => 'draft_imported',
            'entity_type' => LmsExamQuestion::class,
            'entity_id' => $question->id,
        ]);

        return $question;
    }

    public function importMockTemplate(LmsAiGenerationJob $job, User $actor): LmsExamTemplate
    {
        $existing = LmsExamTemplate::query()->where('generation_job_id', $job->id)->first();
        if ($existing) {
            return $existing;
        }

        $request = $job->request_json ?? [];
        $exam = LmsExam::query()->find($job->exam_id);
        $format = $exam?->exam_format_json ?? [];
        $independent = (int) ($request['independent_count'] ?? 0);
        $total = max(1, (int) ($request['mock_question_count'] ?? $independent));
        $duration = (int) ($request['duration_minutes'] ?? $format['duration_minutes'] ?? 30);

        $template = LmsExamTemplate::query()->create([
            'exam_id' => $job->exam_id,
            'course_id' => $job->course_id,
            'generation_job_id' => $job->id,
            'name' => ($job->title ?: 'Citizenship mock').' pool',
            'slug' => 'lms-mock-job-'.$job->id,
            'total_questions' => $total,
            'duration_minutes' => $duration,
            'independent_count' => $independent,
            'case_based_count' => (int) ($request['case_based_count'] ?? 0),
            'selection_mode' => 'random_pool',
            'randomize_questions' => true,
            'randomize_options' => true,
            'allow_navigation' => true,
            'allow_review' => true,
            'allow_answer_review_after_submit' => true,
            'group_case_questions' => false,
            'content_language' => $job->content_language ?: 'en',
            'status' => 'draft',
            'version_number' => 1,
            'created_by' => $actor->id,
            'difficulty_mix_json' => $request['difficulty_mix'] ?? null,
            'topic_mix_json' => $request['topic_mix'] ?? null,
        ]);
        LmsAiGuard::assertDraftOnly((string) $template->status, false);

        return $template;
    }

    public function assertNonEmptyImport(LmsAiGenerationJob $job): void
    {
        $request = $job->request_json ?? [];
        $wantLessons = $job->type === 'course' && ($request['generate_lessons'] ?? true);
        $wantMcqs = (bool) ($request['generate_independent_mcqs'] ?? true);
        $wantMock = (bool) ($request['include_mock'] ?? true);
        $course = $job->course_id ? LmsCourse::query()->with('modules.lessons')->find($job->course_id) : null;

        if ($wantLessons) {
            if (! $course) {
                throw new AcademyAiException('LMS importer did not create a course draft.');
            }
            $moduleCount = $course->modules->count();
            $lessonCount = $course->modules->sum(fn (LmsModule $module) => $module->lessons->count());
            if ($moduleCount < 1 || $lessonCount < 1) {
                throw new AcademyAiException('LMS importer refused an empty course shell. Modules and lessons are required.');
            }
            LmsAiGuard::assertDraftOnly((string) $course->review_status, (bool) $course->is_published);
        }

        if ($wantMcqs) {
            $questionCount = LmsExamQuestion::query()->where('generation_job_id', $job->id)->count();
            if ($questionCount < 1) {
                throw new AcademyAiException('LMS importer refused an empty question bank.');
            }
            if ($course && LmsCourseQuestion::query()->where('course_id', $course->id)->count() < 1) {
                throw new AcademyAiException('LMS importer refused an empty course question bank.');
            }
        }

        if ($wantMock && ! LmsExamTemplate::query()->where('generation_job_id', $job->id)->exists()) {
            throw new AcademyAiException('LMS importer did not create the mock template.');
        }
    }

    public function publishGenerated(): never
    {
        LmsAiGuard::denyPublish();
    }

    private function linkCourseQuestion(LmsAiGenerationJob $job, LmsExamQuestion $question, LmsAiGeneratedItem $item): void
    {
        if (! $job->course_id) {
            return;
        }
        $payload = $item->payload_json ?? [];
        LmsCourseQuestion::query()->firstOrCreate(
            [
                'course_id' => $job->course_id,
                'question_id' => $question->id,
            ],
            [
                'practice_eligible' => (bool) ($payload['practice_eligible'] ?? true),
                'mock_eligible' => (bool) ($payload['mock_eligible'] ?? true),
            ]
        );
    }

    private function categoryForProfile(string $profile): LmsCategory
    {
        $slug = $profile === 'language_exam_prep' ? 'language-exam-prep' : 'citizenship-exam-prep';
        $name = $profile === 'language_exam_prep' ? 'Language exam prep' : 'Citizenship exam prep';

        return LmsCategory::query()->firstOrCreate(
            ['slug' => $slug],
            ['name' => $name, 'is_active' => true, 'sort_order' => 0]
        );
    }

    private function reviewStatusForLanguage(string $language): string
    {
        return in_array($language, ['fr', 'bilingual'], true) ? 'language_review' : 'content_review';
    }

    /** @param array<string, mixed> $payload */
    private function lessonHtml(array $payload): string
    {
        $sections = [
            'Objectives' => implode('</li><li>', $payload['objectives'] ?? []),
            'Overview' => $payload['overview'] ?? '',
            'Key concepts' => implode('</li><li>', $payload['key_concepts'] ?? []),
            'Official guide notes' => implode('</li><li>', $payload['relevant_law'] ?? $payload['official_guide_refs'] ?? []),
            'Explanations' => $payload['practical_interpretation'] ?? ($payload['explanations'] ?? ''),
            'Exam-focused notes' => $payload['exam_notes'] ?? '',
            'Common mistakes' => implode('</li><li>', $payload['common_mistakes'] ?? []),
            'Worked example' => $payload['worked_example'] ?? '',
            'Revision' => implode('</li><li>', $payload['takeaways'] ?? $payload['revision'] ?? []),
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
}

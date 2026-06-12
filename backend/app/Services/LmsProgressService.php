<?php

namespace App\Services;

use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsCourseAssignment;
use App\Models\Lms\LmsHomeworkSubmission;
use App\Models\Lms\LmsLesson;
use App\Models\Lms\LmsLessonCompletion;
use App\Models\Lms\LmsQuizAttempt;

class LmsProgressService
{
    public function totalLessonsForCourse(int $courseId): int
    {
        return LmsLesson::query()
            ->whereIn('module_id', function ($q) use ($courseId) {
                $q->select('id')->from('lms_modules')->where('course_id', $courseId);
            })
            ->count();
    }

    public function recalculate(LmsCourseAssignment $assignment): LmsCourseAssignment
    {
        $total = $this->totalLessonsForCourse($assignment->course_id);
        $completed = LmsLessonCompletion::where('assignment_id', $assignment->id)->count();

        $percent = $total > 0 ? (int) round(($completed / $total) * 100) : 0;
        $status  = $percent >= 100 ? 'completed' : ($percent > 0 ? 'in_progress' : 'assigned');

        $assignment->update([
            'progress_percent' => $percent,
            'status'           => $status,
            'completed_at'     => $percent >= 100 ? now() : null,
        ]);

        return $assignment->fresh();
    }

    public function coursePayload(LmsCourse $course, ?LmsCourseAssignment $assignment = null): array
    {
        $course->load(['category', 'modules.lessons', 'quizzes.bankLinks', 'homework']);

        $completedLessonIds = $assignment
            ? LmsLessonCompletion::where('assignment_id', $assignment->id)->pluck('lesson_id')->all()
            : [];

        $attempts = $assignment
            ? LmsQuizAttempt::with('quiz')->where('assignment_id', $assignment->id)->orderByDesc('attempted_at')->get()
            : collect();

        $homeworkSubs = $assignment
            ? LmsHomeworkSubmission::where('assignment_id', $assignment->id)->get()->keyBy('homework_id')
            : collect();

        return [
            'id'            => $course->id,
            'title'         => $course->title,
            'description'   => $course->description,
            'thumbnail_url' => $course->thumbnail_url,
            'category'      => $course->category?->only(['id', 'name', 'slug']),
            'modules'     => $course->modules->map(fn ($m) => [
                'id'      => $m->id,
                'title'   => $m->title,
                'lessons' => $m->lessons->map(fn ($l) => [
                    'id'               => $l->id,
                    'title'            => $l->title,
                    'lesson_type'      => $l->lesson_type,
                    'video_url'        => $l->video_url,
                    'pdf_url'          => $l->pdf_url,
                    'text_content'     => $l->text_content,
                    'duration_minutes' => $l->duration_minutes,
                    'is_completed'     => in_array($l->id, $completedLessonIds, true),
                ]),
            ]),
            'quizzes' => $course->quizzes->map(function ($q) use ($attempts) {
                $best = $attempts->where('quiz_id', $q->id)->sortByDesc('score_percent')->first();

                return [
                    'id'                 => $q->id,
                    'title'              => $q->title,
                    'content_type'       => $q->content_type ?? 'quiz',
                    'source_mode'        => $q->source_mode ?? 'inline',
                    'passing_score'      => $q->passing_score,
                    'time_limit_minutes' => $q->time_limit_minutes,
                    'question_count'     => $q->source_mode === 'bank_random'
                        ? ($q->random_question_count ?? 0)
                        : ($q->source_mode === 'bank_fixed'
                            ? $q->bankLinks->count()
                            : $q->questions()->count()),
                    'best_score'         => $best?->score_percent,
                    'last_passed'        => $best?->passed,
                    'attempts_count'     => $attempts->where('quiz_id', $q->id)->count(),
                ];
            }),
            'homework' => $course->homework->map(fn ($h) => [
                'id'           => $h->id,
                'title'        => $h->title,
                'instructions' => $h->instructions,
                'max_score'    => $h->max_score,
                'submitted'    => $homeworkSubs->has($h->id),
                'submission'   => $homeworkSubs->get($h->id)?->only(['id', 'status', 'score', 'submitted_at']),
            ]),
            'exam_attempts' => $attempts->map(fn ($a) => [
                'id'            => $a->id,
                'quiz_id'       => $a->quiz_id,
                'quiz_title'    => $a->quiz?->title,
                'content_type'  => $a->quiz?->content_type,
                'score_percent' => $a->score_percent,
                'passed'        => $a->passed,
                'attempted_at'  => $a->attempted_at,
            ]),
            'assignment' => $assignment ? [
                'id'               => $assignment->id,
                'progress_percent' => $assignment->progress_percent,
                'status'           => $assignment->status,
            ] : null,
        ];
    }
}

<?php

namespace App\Services\Academy;

use App\Models\Academy\AcademyCourse;
use App\Models\Academy\AcademyCourseVersion;
use App\Models\Academy\AcademyLearningProgress;
use App\Models\Academy\AcademyLesson;
use App\Models\Academy\AcademyLessonCompletion;
use App\Models\Academy\AcademyModule;
use App\Models\User;
use Illuminate\Support\Str;

class AcademyCourseService
{
    public function __construct(private AcademyAccess $access) {}

    public function createDraft(array $data, User $actor): AcademyCourse
    {
        $course = AcademyCourse::query()->create([
            'track_id' => $data['track_id'] ?? null,
            'title' => $data['title'],
            'slug' => $data['slug'] ?? Str::slug($data['title']).'-'.Str::lower(Str::random(6)),
            'description' => $data['description'] ?? null,
            'thumbnail_url' => $data['thumbnail_url'] ?? null,
            'category' => $data['category'] ?? null,
            'difficulty' => $data['difficulty'] ?? 'intermediate',
            'estimated_hours' => $data['estimated_hours'] ?? null,
            'access_tier' => $data['access_tier'] ?? 'subscription',
            'status' => 'draft',
            'created_by' => $actor->id,
        ]);

        AcademyCourseVersion::query()->create([
            'course_id' => $course->id,
            'version_number' => 1,
            'title' => $course->title,
            'description' => $course->description,
            'estimated_hours' => $course->estimated_hours,
            'status' => 'draft',
            'created_by' => $actor->id,
        ]);

        return $course->fresh('versions');
    }

    public function draftVersionForEdit(AcademyCourse $course, User $actor): AcademyCourseVersion
    {
        $draft = $course->versions()->whereNotIn('status', ['published', 'archived'])->latest('version_number')->first();
        if ($draft) {
            return $draft;
        }

        $published = $course->publishedVersion;
        $next = (int) $course->versions()->max('version_number') + 1;
        $version = AcademyCourseVersion::query()->create([
            'course_id' => $course->id,
            'version_number' => $next,
            'title' => $published?->title ?? $course->title,
            'description' => $published?->description ?? $course->description,
            'estimated_hours' => $published?->estimated_hours ?? $course->estimated_hours,
            'status' => 'draft',
            'created_by' => $actor->id,
            'change_notes' => 'New draft from published version '.$published?->version_number,
        ]);

        if ($published) {
            foreach ($published->modules as $module) {
                $copy = AcademyModule::query()->create([
                    'course_version_id' => $version->id,
                    'title' => $module->title,
                    'sort_order' => $module->sort_order,
                ]);
                foreach ($module->lessons as $lesson) {
                    AcademyLesson::query()->create([
                        'module_id' => $copy->id,
                        'title' => $lesson->title,
                        'lesson_type' => $lesson->lesson_type,
                        'body_html' => $lesson->body_html,
                        'media_url' => $lesson->media_url,
                        'media_disk' => $lesson->media_disk,
                        'duration_minutes' => $lesson->duration_minutes,
                        'sort_order' => $lesson->sort_order,
                        'quiz_spec_json' => $lesson->quiz_spec_json,
                    ]);
                }
            }
        }

        return $version->fresh('modules.lessons');
    }

    public function publishVersion(AcademyCourse $course, AcademyCourseVersion $version, User $actor, AcademyWorkflow $workflow, bool $override = false): void
    {
        $workflow->transition($version, 'published', $actor, null, $override);
        $course->update([
            'status' => 'published',
            'current_published_version_id' => $version->id,
            'title' => $version->title,
            'description' => $version->description,
            'estimated_hours' => $version->estimated_hours,
        ]);
    }

    public function learnerCourse(User $user, AcademyCourse $course): array
    {
        $this->access->assertCourse($user, $course);
        $progress = $this->ensureProgress($user, $course);
        $version = $this->pinnedVersion($course, $progress);

        return [
            'course' => $this->courseSummary($course),
            'version' => [
                'id' => $version->id,
                'version_number' => $version->version_number,
                'is_latest' => (int) $version->id === (int) $course->current_published_version_id,
            ],
            'can_switch_to_latest' => $progress && (int) $progress->course_version_id !== (int) $course->current_published_version_id,
            'disclaimer' => config('academy.disclaimer'),
            'modules' => $version->modules()->with('lessons')->get()->map(fn (AcademyModule $module) => [
                'id' => $module->id,
                'title' => $module->title,
                'lessons' => $module->lessons->map(fn (AcademyLesson $lesson) => [
                    'id' => $lesson->id,
                    'title' => $lesson->title,
                    'lesson_type' => $lesson->lesson_type,
                    'duration_minutes' => $lesson->duration_minutes,
                    'completed' => AcademyLessonCompletion::query()
                        ->where('user_id', $user->id)
                        ->where('lesson_id', $lesson->id)
                        ->where('course_version_id', $version->id)
                        ->exists(),
                ]),
            ]),
            'progress' => $progress,
        ];
    }

    public function completeLesson(User $user, AcademyCourse $course, AcademyLesson $lesson): AcademyLearningProgress
    {
        $this->access->assertCourse($user, $course);
        $progress = $this->ensureProgress($user, $course);
        $version = AcademyCourseVersion::query()->findOrFail($progress->course_version_id);

        $belongs = $version->modules()->whereKey($lesson->module_id)->exists();
        if (! $belongs) {
            abort(404);
        }

        AcademyLessonCompletion::query()->firstOrCreate(
            [
                'user_id' => $user->id,
                'lesson_id' => $lesson->id,
                'course_version_id' => $version->id,
            ],
            ['completed_at' => now()]
        );

        $total = AcademyLesson::query()->whereIn('module_id', $version->modules()->pluck('id'))->count();
        $done = AcademyLessonCompletion::query()
            ->where('user_id', $user->id)
            ->where('course_version_id', $version->id)
            ->count();
        $percent = $total > 0 ? round($done / $total * 100, 2) : 0;

        $progress->update([
            'completion_percent' => $percent,
            'last_lesson_id' => $lesson->id,
            'status' => $percent >= 100 ? 'completed' : 'in_progress',
            'completed_at' => $percent >= 100 ? now() : null,
        ]);

        return $progress->fresh();
    }

    public function switchToLatest(User $user, AcademyCourse $course): AcademyLearningProgress
    {
        $this->access->assertCourse($user, $course);
        $progress = $this->ensureProgress($user, $course);
        $progress->update([
            'course_version_id' => $course->current_published_version_id,
            'completion_percent' => 0,
            'status' => 'in_progress',
            'completed_at' => null,
            'last_lesson_id' => null,
        ]);

        return $progress->fresh();
    }

    public function ensureProgress(User $user, AcademyCourse $course): AcademyLearningProgress
    {
        return AcademyLearningProgress::query()->firstOrCreate(
            ['user_id' => $user->id, 'course_id' => $course->id],
            [
                'course_version_id' => $course->current_published_version_id,
                'status' => 'in_progress',
                'completion_percent' => 0,
                'started_at' => now(),
            ]
        );
    }

    public function pinnedVersion(AcademyCourse $course, ?AcademyLearningProgress $progress): AcademyCourseVersion
    {
        if ($progress?->course_version_id) {
            return AcademyCourseVersion::query()->findOrFail($progress->course_version_id);
        }

        return $course->publishedVersion()->with('modules.lessons')->firstOrFail();
    }

    /** @return array<string, mixed> */
    public function courseSummary(AcademyCourse $course): array
    {
        return [
            'id' => $course->id,
            'title' => $course->title,
            'slug' => $course->slug,
            'description' => $course->description,
            'thumbnail_url' => $course->thumbnail_url,
            'difficulty' => $course->difficulty,
            'estimated_hours' => $course->estimated_hours,
            'access_tier' => $course->access_tier,
            'track_id' => $course->track_id,
        ];
    }
}

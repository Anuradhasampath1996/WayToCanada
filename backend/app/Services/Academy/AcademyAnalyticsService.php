<?php

namespace App\Services\Academy;

use App\Models\Academy\AcademyExamAttempt;
use App\Models\Academy\AcademyLearningProgress;
use App\Models\Academy\AcademyQuestion;
use App\Models\Academy\AcademyQuestionAttempt;
use App\Models\Academy\AcademyQuestionVersion;
use App\Models\Academy\AcademyStudyPlan;
use App\Models\Academy\AcademyTopic;
use App\Models\User;

class AcademyAnalyticsService
{
    public function dashboard(User $user): array
    {
        $attempts = AcademyQuestionAttempt::query()->where('user_id', $user->id)->get();
        $independent = $attempts->whereIn('question_id', $this->idsOfType('independent_mcq'));
        $caseBased = $attempts->whereIn('question_id', $this->idsOfType('case_mcq'));
        $mocks = AcademyExamAttempt::query()
            ->where('user_id', $user->id)
            ->whereIn('status', [AcademyExamAttempt::STATUS_SUBMITTED, AcademyExamAttempt::STATUS_EXPIRED_SUBMITTED])
            ->orderByDesc('submitted_at')
            ->get();
        $progress = AcademyLearningProgress::query()->where('user_id', $user->id)->get();
        $active = $progress->sortByDesc('updated_at')->first();
        $plan = AcademyStudyPlan::query()->where('user_id', $user->id)->where('status', 'active')->latest()->first();

        $mockAvg = $mocks->avg('score_percent');
        $latestMock = $mocks->first()?->score_percent;

        return [
            'disclaimer' => config('academy.disclaimer'),
            'readiness_label' => 'Exam Readiness Score — not an official pass prediction',
            'exam_readiness_percent' => $this->readiness(
                $progress->avg('completion_percent'),
                $this->accuracy($independent),
                $this->accuracy($caseBased),
                $latestMock ?? $mockAvg
            ),
            'active_course' => $active,
            'course_completion_percent' => round((float) ($progress->avg('completion_percent') ?? 0), 1),
            'questions_attempted' => $attempts->count(),
            'independent_mcq_accuracy' => $this->accuracy($independent),
            'case_based_accuracy' => $this->accuracy($caseBased),
            'mock_exam_average' => $mockAvg !== null ? (int) round($mockAvg) : null,
            'study_streak_days' => $this->streak($attempts),
            'study_hours' => round($attempts->sum('time_spent_seconds') / 3600, 1),
            'weak_topics' => $this->topicAccuracy($user->id, true),
            'upcoming_exam_date' => $plan?->exam_date?->toDateString(),
            'today' => $this->todayRecommendations($user, $this->topicAccuracy($user->id, true)),
        ];
    }

    public function learnerAnalytics(User $user): array
    {
        $attempts = AcademyQuestionAttempt::query()->where('user_id', $user->id)->get();

        return [
            'disclaimer' => config('academy.disclaimer'),
            'total_attempted' => $attempts->count(),
            'correct_percent' => $this->accuracy($attempts),
            'independent_mcq_percent' => $this->accuracy($attempts->whereIn('question_id', $this->idsOfType('independent_mcq'))),
            'case_based_percent' => $this->accuracy($attempts->whereIn('question_id', $this->idsOfType('case_mcq'))),
            'topic_percent' => $this->topicAccuracy($user->id, false),
            'competency_percent' => $this->competencyAccuracy($user->id),
            'average_seconds' => $attempts->count() ? (int) round($attempts->avg('time_spent_seconds')) : null,
            'mock_trend' => AcademyExamAttempt::query()
                ->where('user_id', $user->id)
                ->whereIn('status', [AcademyExamAttempt::STATUS_SUBMITTED, AcademyExamAttempt::STATUS_EXPIRED_SUBMITTED])
                ->orderBy('submitted_at')
                ->get(['id', 'score_percent', 'submitted_at']),
        ];
    }

    public function adminQuestionStats(): array
    {
        $min = (int) config('academy.discrimination_min_sample', 20);
        $questions = AcademyQuestion::query()->where('status', 'published')->get();

        return $questions->map(function (AcademyQuestion $question) use ($min) {
            $rows = AcademyQuestionAttempt::query()->where('question_id', $question->id)->get();
            $n = $rows->count();
            $accuracy = $this->accuracy($rows);
            $discrimination = null;
            if ($n >= $min) {
                $sorted = $rows->sortBy('is_correct')->values();
                $q = (int) floor($n / 4);
                $bottom = $sorted->take($q);
                $top = $sorted->reverse()->take($q);
                $discrimination = $this->accuracy($top) - $this->accuracy($bottom);
            }

            return [
                'question_id' => $question->id,
                'attempts' => $n,
                'accuracy' => $accuracy,
                'discrimination' => $discrimination,
            ];
        })->values()->all();
    }

    public function readinessForUser(int $userId, ?int $latestMock = null): int
    {
        $user = new User(['id' => $userId]);
        $user->id = $userId;
        $data = $this->dashboard($user);
        if ($latestMock !== null) {
            return $this->readiness(
                $data['course_completion_percent'],
                $data['independent_mcq_accuracy'],
                $data['case_based_accuracy'],
                $latestMock
            );
        }

        return (int) $data['exam_readiness_percent'];
    }

    public function readiness(?float $course, ?float $independent, ?float $case, ?float $mock): int
    {
        $parts = array_filter([
            'course_completion' => $course,
            'independent_mcq' => $independent,
            'case_based' => $case,
            'mock' => $mock,
        ], fn ($v) => $v !== null);
        if ($parts === []) {
            return 0;
        }
        $weights = config('academy.readiness_weights');
        $available = array_intersect_key($weights, $parts);
        $sum = array_sum($available) ?: 1;
        $score = 0;
        foreach ($available as $key => $weight) {
            $score += ($weight / $sum) * (float) $parts[$key];
        }

        return (int) round($score);
    }

    private function accuracy($attempts): ?float
    {
        $n = $attempts->count();
        if ($n === 0) {
            return null;
        }

        return round($attempts->where('is_correct', true)->count() / $n * 100, 1);
    }

    private function idsOfType(string $type)
    {
        return AcademyQuestion::query()->where('type', $type)->pluck('id');
    }

    private function topicAccuracy(int $userId, bool $weakOnly): array
    {
        $attempts = AcademyQuestionAttempt::query()->where('user_id', $userId)->get();
        $byTopic = [];
        foreach ($attempts as $attempt) {
            $version = AcademyQuestionVersion::query()->with('topics')->find($attempt->question_version_id);
            foreach ($version?->topics ?? [] as $topic) {
                $byTopic[$topic->id]['name'] = $topic->name;
                $byTopic[$topic->id]['n'] = ($byTopic[$topic->id]['n'] ?? 0) + 1;
                $byTopic[$topic->id]['ok'] = ($byTopic[$topic->id]['ok'] ?? 0) + ($attempt->is_correct ? 1 : 0);
            }
        }

        $threshold = (int) config('academy.weak_topic_threshold', 70);
        $min = (int) config('academy.weak_topic_min_attempts', 5);

        return collect($byTopic)->map(function ($row, $id) {
            return [
                'topic_id' => (int) $id,
                'name' => $row['name'],
                'attempts' => $row['n'],
                'accuracy' => (int) round($row['ok'] / max(1, $row['n']) * 100),
            ];
        })->when($weakOnly, fn ($c) => $c->filter(fn ($r) => $r['attempts'] >= $min && $r['accuracy'] < $threshold))
            ->sortBy('accuracy')
            ->values()
            ->all();
    }

    private function competencyAccuracy(int $userId): array
    {
        $attempts = AcademyQuestionAttempt::query()->where('user_id', $userId)->get();
        $by = [];
        foreach ($attempts as $attempt) {
            $version = AcademyQuestionVersion::query()->with('competencies')->find($attempt->question_version_id);
            foreach ($version?->competencies ?? [] as $comp) {
                $by[$comp->id]['name'] = $comp->name;
                $by[$comp->id]['n'] = ($by[$comp->id]['n'] ?? 0) + 1;
                $by[$comp->id]['ok'] = ($by[$comp->id]['ok'] ?? 0) + ($attempt->is_correct ? 1 : 0);
            }
        }

        return collect($by)->map(fn ($row, $id) => [
            'competency_id' => (int) $id,
            'name' => $row['name'],
            'accuracy' => (int) round($row['ok'] / max(1, $row['n']) * 100),
        ])->values()->all();
    }

    private function streak($attempts): int
    {
        $days = $attempts->pluck('attempted_at')->filter()->map(fn ($d) => $d->toDateString())->unique()->sort()->values();
        if ($days->isEmpty()) {
            return 0;
        }
        $streak = 0;
        $cursor = now()->startOfDay();
        while ($days->contains($cursor->toDateString())) {
            $streak++;
            $cursor->subDay();
        }

        return $streak;
    }

    private function todayRecommendations(User $user, array $weak): array
    {
        $topic = $weak[0]['name'] ?? 'IRB Foundations';

        return [
            ['minutes' => 15, 'label' => '15 min '.$topic.' lesson'],
            ['minutes' => 20, 'label' => '20 weak-topic MCQs'],
            ['minutes' => 25, 'label' => '1 case scenario'],
        ];
    }
}

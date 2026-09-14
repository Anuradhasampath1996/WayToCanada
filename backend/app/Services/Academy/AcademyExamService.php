<?php

namespace App\Services\Academy;

use App\Models\Academy\AcademyCourseQuestion;
use App\Models\Academy\AcademyExamAttempt;
use App\Models\Academy\AcademyExamAttemptAnswer;
use App\Models\Academy\AcademyExamTemplate;
use App\Models\Academy\AcademyQuestion;
use App\Models\Academy\AcademyQuestionAttempt;
use App\Models\Academy\AcademyQuestionVersion;
use App\Models\User;

class AcademyExamService
{
    public function __construct(
        private AcademyAccess $access,
        private AcademyPayload $payload,
        private AcademyAnalyticsService $analytics,
    ) {}

    public function start(User $user, AcademyExamTemplate $template): AcademyExamAttempt
    {
        if (! $template->isPublished()) {
            abort(404);
        }
        if ($template->course_id) {
            $course = \App\Models\Academy\AcademyCourse::query()->find($template->course_id);
            if ($course) {
                $this->access->assertCourse($user, $course);
            } else {
                $this->access->assertAcademySurface($user);
            }
        } else {
            $this->access->assertAcademySurface($user);
        }

        $open = AcademyExamAttempt::query()
            ->where('user_id', $user->id)
            ->where('exam_template_id', $template->id)
            ->where('status', AcademyExamAttempt::STATUS_IN_PROGRESS)
            ->first();
        if ($open) {
            return $this->finalizeIfExpired($open);
        }

        if ($template->max_attempts !== null) {
            $used = AcademyExamAttempt::query()
                ->where('user_id', $user->id)
                ->where('exam_template_id', $template->id)
                ->whereIn('status', [AcademyExamAttempt::STATUS_SUBMITTED, AcademyExamAttempt::STATUS_EXPIRED_SUBMITTED])
                ->count();
            if ($used >= $template->max_attempts) {
                abort(422, 'No remaining attempts for this exam template.');
            }
        }

        $set = $this->buildQuestionSet($user, $template);
        $started = now();

        return AcademyExamAttempt::query()->create([
            'user_id' => $user->id,
            'exam_template_id' => $template->id,
            'exam_template_version' => $template->version_number ?? 1,
            'started_at' => $started,
            'expires_at' => $started->copy()->addMinutes((int) $template->duration_minutes),
            'status' => AcademyExamAttempt::STATUS_IN_PROGRESS,
            'question_set_json' => $set,
        ]);
    }

    public function show(User $user, AcademyExamAttempt $attempt): array
    {
        $this->access->assertOwnUser($user, (int) $attempt->user_id);
        $attempt = $this->finalizeIfExpired($attempt);
        $template = AcademyExamTemplate::query()->findOrFail($attempt->exam_template_id);
        $answers = $attempt->answers()->get()->keyBy('question_id');
        $allowReview = $template->allow_answer_review_after_submit ?? true;
        $reveal = $attempt->status !== AcademyExamAttempt::STATUS_IN_PROGRESS && $allowReview;

        $questions = collect($attempt->question_set_json)->map(function (array $item, int $index) use ($template, $answers, $reveal) {
            $version = AcademyQuestionVersion::query()->findOrFail($item['question_version_id']);
            $frozen = $item['option_ids'] ?? null;
            $shuffle = (bool) $template->randomize_options && ! $reveal && ! is_array($frozen);
            $payload = $this->payload->learnerQuestion($version, $shuffle, $reveal, is_array($frozen) ? $frozen : null);
            $payload['type'] = $item['type'] ?? $payload['type'];
            $payload['number'] = $index + 1;
            $payload['flagged'] = (bool) $answers->get($item['question_id'])?->flagged;
            $payload['selected_option_id'] = $answers->get($item['question_id'])?->selected_option_id;
            if ($reveal) {
                $payload['is_correct'] = $answers->get($item['question_id'])?->is_correct;
            }

            return $payload;
        });

        return [
            'attempt' => $this->attemptMeta($attempt, $template),
            'questions' => $questions,
            'disclaimer' => config('academy.disclaimer'),
        ];
    }

    public function saveAnswer(User $user, AcademyExamAttempt $attempt, array $payload): AcademyExamAttempt
    {
        $this->access->assertOwnUser($user, (int) $attempt->user_id);
        $attempt = $this->finalizeIfExpired($attempt);
        if (! $attempt->isOpen()) {
            abort(422, 'This exam is no longer accepting answers.');
        }

        $item = collect($attempt->question_set_json)->firstWhere('question_id', (int) $payload['question_id']);
        if (! $item) {
            abort(404);
        }

        AcademyExamAttemptAnswer::query()->updateOrCreate(
            ['attempt_id' => $attempt->id, 'question_id' => $item['question_id']],
            [
                'question_version_id' => $item['question_version_id'],
                'selected_option_id' => $payload['selected_option_id'] ?? null,
                'flagged' => (bool) ($payload['flagged'] ?? false),
                'time_spent_seconds' => $payload['time_spent_seconds'] ?? null,
                'answered_at' => isset($payload['selected_option_id']) ? now() : null,
                'is_correct' => null,
            ]
        );

        return $attempt->fresh();
    }

    public function submit(User $user, AcademyExamAttempt $attempt, bool $expired = false): array
    {
        $this->access->assertOwnUser($user, (int) $attempt->user_id);
        if (in_array($attempt->status, [AcademyExamAttempt::STATUS_SUBMITTED, AcademyExamAttempt::STATUS_EXPIRED_SUBMITTED], true)) {
            abort(422, 'This exam has already been submitted.');
        }

        if (! $expired && $attempt->isExpired()) {
            $expired = true;
        }
        if (! $expired && ! $attempt->isOpen()) {
            abort(422, 'This exam can no longer be submitted.');
        }

        return $this->score($attempt, $expired);
    }

    public function finalizeIfExpired(AcademyExamAttempt $attempt): AcademyExamAttempt
    {
        if ($attempt->isExpired()) {
            $this->score($attempt, true);
            $attempt->refresh();
        }

        return $attempt;
    }

    /** @return list<array{question_id:int,question_version_id:int,type:string,option_ids:list<int>,case_version_id:?int}> */
    private function buildQuestionSet(User $user, AcademyExamTemplate $template): array
    {
        $mode = $template->selection_mode ?: 'random_pool';
        if ($mode === 'fixed_form' && is_array($template->fixed_question_version_ids_json) && $template->fixed_question_version_ids_json !== []) {
            $picked = collect($template->fixed_question_version_ids_json)->map(function ($versionId) {
                $version = AcademyQuestionVersion::query()->with('question')->findOrFail($versionId);

                return $version->question;
            });
        } else {
            $independent = $this->preferUnseen($user, $template, $this->eligibleOfType($template, 'independent_mcq'));
            $caseBased = $this->preferUnseen($user, $template, $this->eligibleOfType($template, 'case_mcq'));

            if ($independent->count() < $template->independent_count || $caseBased->count() < $template->case_based_count) {
                abort(422, 'Not enough published questions to build this exam template.');
            }

            $picked = $independent->take($template->independent_count)
                ->concat($caseBased->take($template->case_based_count));

            if ($template->randomize_questions) {
                $picked = $picked->shuffle();
            }
        }

        return $picked->map(function (AcademyQuestion $q) use ($template) {
            $version = AcademyQuestionVersion::query()->with('options')->findOrFail($q->current_published_version_id);
            $options = $version->options;
            if ($template->randomize_options) {
                $options = $options->shuffle()->values();
            }

            return [
                'question_id' => $q->id,
                'question_version_id' => $q->current_published_version_id,
                'type' => $q->type,
                'option_ids' => $options->pluck('id')->map(fn ($id) => (int) $id)->all(),
                'case_version_id' => $version->case_version_id ? (int) $version->case_version_id : null,
            ];
        })->values()->all();
    }

    private function eligibleOfType(AcademyExamTemplate $template, string $type)
    {
        $query = AcademyQuestion::query()
            ->where('status', 'published')
            ->where('type', $type)
            ->whereNotNull('current_published_version_id');

        if ($template->exam_id) {
            $query->where('exam_id', $template->exam_id);
        }
        if ($template->course_id) {
            $query->whereIn('id', AcademyCourseQuestion::query()
                ->where('course_id', $template->course_id)
                ->where('mock_eligible', true)
                ->pluck('question_id'));
        } elseif ($template->exam_id) {
            $query->where('mock_eligible', true);
        }

        return $query->get();
    }

    private function preferUnseen(User $user, AcademyExamTemplate $template, $questions)
    {
        $recent = AcademyExamAttempt::query()
            ->where('user_id', $user->id)
            ->where('exam_template_id', $template->id)
            ->whereIn('status', [AcademyExamAttempt::STATUS_SUBMITTED, AcademyExamAttempt::STATUS_EXPIRED_SUBMITTED])
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->limit(3)
            ->get();
        $weights = [];
        foreach ($recent as $i => $attempt) {
            $weight = 3 - $i;
            foreach ($attempt->question_set_json ?? [] as $item) {
                $qid = (int) ($item['question_id'] ?? 0);
                $weights[$qid] = ($weights[$qid] ?? 0) + $weight;
            }
        }

        return $questions->shuffle()->sortBy(fn (AcademyQuestion $q) => $weights[$q->id] ?? 0)->values();
    }

    private function score(AcademyExamAttempt $attempt, bool $expired): array
    {
        $attempt->load('answers');
        $independentCorrect = $independentTotal = $caseCorrect = $caseTotal = 0;
        $topicHits = $topicTotal = $compHits = $compTotal = $diffHits = $diffTotal = [];

        foreach ($attempt->question_set_json as $item) {
            $version = AcademyQuestionVersion::query()->with(['options', 'topics', 'competencies', 'question'])->findOrFail($item['question_version_id']);
            $answer = $attempt->answers->firstWhere('question_id', $item['question_id']);
            $correctId = $version->options->firstWhere('is_correct', true)?->id;
            $isCorrect = $answer?->selected_option_id && (int) $answer->selected_option_id === (int) $correctId;

            if ($answer) {
                $answer->update(['is_correct' => $isCorrect]);
            } else {
                AcademyExamAttemptAnswer::query()->create([
                    'attempt_id' => $attempt->id,
                    'question_id' => $item['question_id'],
                    'question_version_id' => $item['question_version_id'],
                    'is_correct' => false,
                ]);
            }

            AcademyQuestionAttempt::query()->create([
                'user_id' => $attempt->user_id,
                'question_id' => $item['question_id'],
                'question_version_id' => $item['question_version_id'],
                'selected_option_id' => $answer?->selected_option_id,
                'is_correct' => $isCorrect,
                'time_spent_seconds' => $answer?->time_spent_seconds,
                'mode' => 'exam',
                'exam_attempt_id' => $attempt->id,
                'attempted_at' => now(),
            ]);

            if ($version->question->type === 'case_mcq') {
                $caseTotal++;
                if ($isCorrect) {
                    $caseCorrect++;
                }
            } else {
                $independentTotal++;
                if ($isCorrect) {
                    $independentCorrect++;
                }
            }

            foreach ($version->topics as $topic) {
                $topicTotal[$topic->id] = ($topicTotal[$topic->id] ?? 0) + 1;
                $topicHits[$topic->id] = ($topicHits[$topic->id] ?? 0) + ($isCorrect ? 1 : 0);
            }
            foreach ($version->competencies as $comp) {
                $compTotal[$comp->id] = ($compTotal[$comp->id] ?? 0) + 1;
                $compHits[$comp->id] = ($compHits[$comp->id] ?? 0) + ($isCorrect ? 1 : 0);
            }
            $diff = (string) ($version->difficulty ?: 'medium');
            $diffTotal[$diff] = ($diffTotal[$diff] ?? 0) + 1;
            $diffHits[$diff] = ($diffHits[$diff] ?? 0) + ($isCorrect ? 1 : 0);
        }

        $total = max(1, count($attempt->question_set_json));
        $correct = $independentCorrect + $caseCorrect;
        $score = (int) round($correct / $total * 100);
        $durationSeconds = (int) round($attempt->started_at?->diffInSeconds(now()) ?? 0);
        $unanswered = collect($attempt->question_set_json)->filter(function (array $item) use ($attempt) {
            $answer = $attempt->answers->firstWhere('question_id', $item['question_id']);

            return ! $answer || $answer->selected_option_id === null;
        })->count();

        $updated = AcademyExamAttempt::query()
            ->where('id', $attempt->id)
            ->where('status', AcademyExamAttempt::STATUS_IN_PROGRESS)
            ->update([
                'status' => $expired ? AcademyExamAttempt::STATUS_EXPIRED_SUBMITTED : AcademyExamAttempt::STATUS_SUBMITTED,
                'submitted_at' => now(),
                'duration_seconds' => $durationSeconds,
                'score_percent' => $score,
                'independent_score_percent' => $independentTotal ? (int) round($independentCorrect / $independentTotal * 100) : null,
                'case_score_percent' => $caseTotal ? (int) round($caseCorrect / $caseTotal * 100) : null,
                'topic_scores_json' => json_encode($this->pctMap($topicHits, $topicTotal)),
                'competency_scores_json' => json_encode($this->pctMap($compHits, $compTotal)),
                'time_analysis_json' => json_encode([
                    'duration_seconds' => $durationSeconds,
                    'expired' => $expired,
                    'difficulty_scores' => $this->pctMap($diffHits, $diffTotal),
                ]),
                'readiness_score' => $this->analytics->readinessForUser((int) $attempt->user_id, $score),
                'submission_reason' => $expired ? 'time_expired' : 'submitted',
                'unanswered_count' => $unanswered,
            ]);

        if ($updated === 0) {
            return $this->show(User::query()->findOrFail($attempt->user_id), $attempt->fresh());
        }

        $attempt->refresh();

        return $this->show(User::query()->findOrFail($attempt->user_id), $attempt->fresh());
    }

    /** @param array<int,int> $hits @param array<int,int> $total */
    private function pctMap(array $hits, array $total): array
    {
        $out = [];
        foreach ($total as $id => $n) {
            $out[(string) $id] = (int) round(($hits[$id] ?? 0) / max(1, $n) * 100);
        }

        return $out;
    }

    /** @return array<string, mixed> */
    private function attemptMeta(AcademyExamAttempt $attempt, AcademyExamTemplate $template): array
    {
        $answers = $attempt->relationLoaded('answers') ? $attempt->answers : $attempt->answers()->get();
        $inProgress = $attempt->status === AcademyExamAttempt::STATUS_IN_PROGRESS;
        $correct = $answers->where('is_correct', true)->count();
        $incorrect = $answers->filter(fn ($a) => $a->is_correct === false && $a->selected_option_id !== null)->count();
        $attemptNumber = AcademyExamAttempt::query()
            ->where('user_id', $attempt->user_id)
            ->where('exam_template_id', $attempt->exam_template_id)
            ->whereIn('status', [AcademyExamAttempt::STATUS_SUBMITTED, AcademyExamAttempt::STATUS_EXPIRED_SUBMITTED])
            ->where('id', '<=', $attempt->id)
            ->count();
        $topic = $attempt->topic_scores_json ?: [];
        $comp = $attempt->competency_scores_json ?: [];
        $time = is_array($attempt->time_analysis_json) ? $attempt->time_analysis_json : [];
        $difficulty = $time['difficulty_scores'] ?? [];

        return [
            'id' => $attempt->id,
            'status' => $attempt->status,
            'started_at' => $attempt->started_at?->toIso8601String(),
            'expires_at' => $attempt->expires_at?->toIso8601String(),
            'server_now' => now()->toIso8601String(),
            'submitted_at' => $attempt->submitted_at?->toIso8601String(),
            'score' => $attempt->score_percent,
            'score_percent' => $attempt->score_percent,
            'percentage' => $attempt->score_percent,
            'correct' => $inProgress ? null : $correct,
            'incorrect' => $inProgress ? null : $incorrect,
            'unanswered' => $attempt->unanswered_count,
            'time_used_seconds' => $attempt->duration_seconds,
            'total_duration_seconds' => ((int) $template->duration_minutes) * 60,
            'attempt_number' => max(1, $attemptNumber ?: ($inProgress ? $attemptNumber + 1 : 1)),
            'submission_reason' => $attempt->submission_reason,
            'independent_score_percent' => $attempt->independent_score_percent,
            'case_score_percent' => $attempt->case_score_percent,
            'topic_scores' => $topic === [] ? null : $topic,
            'competency_scores' => $comp === [] ? null : $comp,
            'difficulty_scores' => $difficulty === [] ? null : $difficulty,
            'readiness_score' => $attempt->readiness_score,
            'readiness_label' => 'Exam Readiness Score — not an official pass prediction',
            'performance_label' => $this->performanceLabel($attempt->score_percent),
            'template' => [
                'id' => $template->id,
                'name' => $template->name,
                'duration_minutes' => $template->duration_minutes,
                'total_questions' => $template->total_questions,
                'allow_navigation' => $template->allow_navigation,
                'allow_review' => $template->allow_review,
                'allow_answer_review_after_submit' => $template->allow_answer_review_after_submit,
            ],
        ];
    }

    private function performanceLabel(?int $score): ?string
    {
        if ($score === null) {
            return null;
        }
        if ($score >= 80) {
            return 'Strong readiness';
        }
        if ($score >= 65) {
            return 'Developing readiness';
        }

        return 'Needs more practice';
    }
}

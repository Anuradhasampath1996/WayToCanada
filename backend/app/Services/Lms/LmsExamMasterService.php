<?php

namespace App\Services\Lms;

use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsCourseAssignment;
use App\Models\Lms\LmsCourseQuestion;
use App\Models\Lms\LmsExamAttempt;
use App\Models\Lms\LmsExamAttemptAnswer;
use App\Models\Lms\LmsExamQuestion;
use App\Models\Lms\LmsExamQuestionOption;
use App\Models\Lms\LmsExamQuestionVersion;
use App\Models\Lms\LmsExamTemplate;
use App\Models\User;

class LmsExamMasterService
{
    public function assertCourseAccess(User $user, LmsCourse $course): LmsCourseAssignment
    {
        if (! $user->hasRole('client')) {
            abort(404);
        }
        $assignment = LmsCourseAssignment::query()
            ->where('client_user_id', $user->id)
            ->where('course_id', $course->id)
            ->latest('assigned_at')
            ->first();
        if (! $assignment) {
            abort(403, 'This course requires a purchase or assignment.');
        }
        if ($assignment->ends_at && $assignment->ends_at->isPast()) {
            abort(403, 'Course access has expired.');
        }

        return $assignment;
    }

    public function start(User $user, LmsExamTemplate $template): LmsExamAttempt
    {
        if (! $template->isPublished()) {
            abort(404);
        }
        if (! $template->course_id) {
            abort(422, 'Exam template is not bound to a course.');
        }
        $course = LmsCourse::query()->findOrFail($template->course_id);
        $this->assertCourseAccess($user, $course);

        $open = LmsExamAttempt::query()
            ->where('user_id', $user->id)
            ->where('exam_template_id', $template->id)
            ->where('status', LmsExamAttempt::STATUS_IN_PROGRESS)
            ->first();
        if ($open) {
            return $this->finalizeIfExpired($open);
        }

        if ($template->max_attempts !== null) {
            $used = LmsExamAttempt::query()
                ->where('user_id', $user->id)
                ->where('exam_template_id', $template->id)
                ->whereIn('status', [LmsExamAttempt::STATUS_SUBMITTED, LmsExamAttempt::STATUS_EXPIRED_SUBMITTED])
                ->count();
            if ($used >= $template->max_attempts) {
                abort(422, 'No remaining attempts for this exam template.');
            }
        }

        $set = $this->buildQuestionSet($user, $template);
        $started = now();

        return LmsExamAttempt::query()->create([
            'user_id' => $user->id,
            'exam_template_id' => $template->id,
            'exam_template_version' => $template->version_number ?? 1,
            'started_at' => $started,
            'expires_at' => $started->copy()->addMinutes((int) $template->duration_minutes),
            'status' => LmsExamAttempt::STATUS_IN_PROGRESS,
            'question_set_json' => $set,
        ]);
    }

    /** @return array<string, mixed> */
    public function show(User $user, LmsExamAttempt $attempt): array
    {
        if ((int) $attempt->user_id !== (int) $user->id) {
            abort(404);
        }
        $attempt = $this->finalizeIfExpired($attempt);
        $template = LmsExamTemplate::query()->findOrFail($attempt->exam_template_id);
        $answers = $attempt->answers()->get()->keyBy('question_id');
        $allowReview = $template->allow_answer_review_after_submit ?? true;
        $reveal = $attempt->status !== LmsExamAttempt::STATUS_IN_PROGRESS && $allowReview;

        $questions = collect($attempt->question_set_json)->map(function (array $item, int $index) use ($answers, $reveal) {
            $version = LmsExamQuestionVersion::query()->with(['options', 'question'])->findOrFail($item['question_version_id']);
            $frozen = $item['option_ids'] ?? [];
            $options = $version->options->sortBy(fn (LmsExamQuestionOption $o) => array_search($o->id, $frozen, false))->values();
            $payload = [
                'id' => $version->question_id,
                'version_id' => $version->id,
                'type' => $item['type'] ?? $version->question->type,
                'number' => $index + 1,
                'question_text' => $version->question_text,
                'difficulty' => $version->difficulty,
                'topics' => $version->topics_json ?: [],
                'competencies' => $version->competencies_json ?: [],
                'flagged' => (bool) $answers->get($item['question_id'])?->flagged,
                'selected_option_id' => $answers->get($item['question_id'])?->selected_option_id,
                'options' => $options->map(fn (LmsExamQuestionOption $o) => [
                    'id' => $o->id,
                    'option_key' => $o->option_key,
                    'option_text' => $o->option_text,
                ])->values(),
            ];
            if ($reveal) {
                $payload['is_correct'] = $answers->get($item['question_id'])?->is_correct;
                $payload['correct_option_id'] = $version->options->firstWhere('is_correct', true)?->id;
                $payload['explanation'] = $version->explanation;
            }

            return $payload;
        });

        return [
            'attempt' => $this->attemptMeta($attempt, $template),
            'questions' => $questions,
            'disclaimer' => 'Practice mock — not an official exam paper.',
        ];
    }

    public function saveAnswer(User $user, LmsExamAttempt $attempt, array $payload): LmsExamAttempt
    {
        if ((int) $attempt->user_id !== (int) $user->id) {
            abort(404);
        }
        $attempt = $this->finalizeIfExpired($attempt);
        if (! $attempt->isOpen()) {
            abort(422, 'This exam is no longer accepting answers.');
        }
        $item = collect($attempt->question_set_json)->firstWhere('question_id', (int) $payload['question_id']);
        if (! $item) {
            abort(404);
        }
        LmsExamAttemptAnswer::query()->updateOrCreate(
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

    /** @return array<string, mixed> */
    public function submit(User $user, LmsExamAttempt $attempt, bool $expired = false): array
    {
        if ((int) $attempt->user_id !== (int) $user->id) {
            abort(404);
        }
        if (in_array($attempt->status, [LmsExamAttempt::STATUS_SUBMITTED, LmsExamAttempt::STATUS_EXPIRED_SUBMITTED], true)) {
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

    public function finalizeIfExpired(LmsExamAttempt $attempt): LmsExamAttempt
    {
        if ($attempt->isExpired()) {
            $this->score($attempt, true);
            $attempt->refresh();
        }

        return $attempt;
    }

    /** @return list<array<string, mixed>> */
    private function buildQuestionSet(User $user, LmsExamTemplate $template): array
    {
        $mode = $template->selection_mode ?: 'random_pool';
        if ($mode === 'fixed_form' && is_array($template->fixed_question_version_ids_json) && $template->fixed_question_version_ids_json !== []) {
            $picked = collect($template->fixed_question_version_ids_json)->map(function ($versionId) {
                $version = LmsExamQuestionVersion::query()->with('question')->findOrFail($versionId);

                return $version->question;
            });
        } else {
            $independent = $this->preferUnseen($user, $template, $this->eligibleOfType($template, 'independent_mcq'));
            $caseBased = $this->preferUnseen($user, $template, $this->eligibleOfType($template, 'case_mcq'));
            $needInd = (int) $template->independent_count;
            $needCase = (int) $template->case_based_count;
            if ($independent->count() < $needInd || $caseBased->count() < $needCase) {
                abort(422, 'Not enough published questions to build this exam template.');
            }
            $picked = $independent->take($needInd)->concat($caseBased->take($needCase));
            if ($template->randomize_questions) {
                $picked = $picked->shuffle();
            }
        }

        return $picked->map(function (LmsExamQuestion $q) use ($template) {
            $version = LmsExamQuestionVersion::query()->with('options')->findOrFail($q->current_published_version_id);
            $options = $version->options;
            if ($template->randomize_options) {
                $options = $options->shuffle()->values();
            }

            return [
                'question_id' => $q->id,
                'question_version_id' => $q->current_published_version_id,
                'type' => $q->type,
                'option_ids' => $options->pluck('id')->map(fn ($id) => (int) $id)->all(),
            ];
        })->values()->all();
    }

    private function eligibleOfType(LmsExamTemplate $template, string $type)
    {
        $query = LmsExamQuestion::query()
            ->where('status', 'published')
            ->where('type', $type)
            ->whereNotNull('current_published_version_id');
        if ($template->exam_id) {
            $query->where('exam_id', $template->exam_id);
        }
        if ($template->course_id) {
            $query->whereIn('id', LmsCourseQuestion::query()
                ->where('course_id', $template->course_id)
                ->where('mock_eligible', true)
                ->pluck('question_id'));
        } else {
            $query->where('mock_eligible', true);
        }

        return $query->get();
    }

    private function preferUnseen(User $user, LmsExamTemplate $template, $questions)
    {
        $recent = LmsExamAttempt::query()
            ->where('user_id', $user->id)
            ->where('exam_template_id', $template->id)
            ->whereIn('status', [LmsExamAttempt::STATUS_SUBMITTED, LmsExamAttempt::STATUS_EXPIRED_SUBMITTED])
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

        return $questions->shuffle()->sortBy(fn (LmsExamQuestion $q) => $weights[$q->id] ?? 0)->values();
    }

    /** @return array<string, mixed> */
    private function score(LmsExamAttempt $attempt, bool $expired): array
    {
        $attempt->load('answers');
        $independentCorrect = $independentTotal = $caseCorrect = $caseTotal = 0;
        $topicHits = $topicTotal = $compHits = $compTotal = $diffHits = $diffTotal = [];

        foreach ($attempt->question_set_json as $item) {
            $version = LmsExamQuestionVersion::query()->with(['options', 'question'])->findOrFail($item['question_version_id']);
            $answer = $attempt->answers->firstWhere('question_id', $item['question_id']);
            $correctId = $version->options->firstWhere('is_correct', true)?->id;
            $isCorrect = $answer?->selected_option_id && (int) $answer->selected_option_id === (int) $correctId;
            if ($answer) {
                $answer->update(['is_correct' => $isCorrect]);
            } else {
                LmsExamAttemptAnswer::query()->create([
                    'attempt_id' => $attempt->id,
                    'question_id' => $item['question_id'],
                    'question_version_id' => $item['question_version_id'],
                    'is_correct' => false,
                ]);
            }
            $type = $version->question->type;
            if ($type === 'case_mcq') {
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
            foreach ($this->labelList($version->topics_json) as $topic) {
                $topicTotal[$topic] = ($topicTotal[$topic] ?? 0) + 1;
                $topicHits[$topic] = ($topicHits[$topic] ?? 0) + ($isCorrect ? 1 : 0);
            }
            foreach ($this->labelList($version->competencies_json) as $comp) {
                $compTotal[$comp] = ($compTotal[$comp] ?? 0) + 1;
                $compHits[$comp] = ($compHits[$comp] ?? 0) + ($isCorrect ? 1 : 0);
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

        $updated = LmsExamAttempt::query()
            ->where('id', $attempt->id)
            ->where('status', LmsExamAttempt::STATUS_IN_PROGRESS)
            ->update([
                'status' => $expired ? LmsExamAttempt::STATUS_EXPIRED_SUBMITTED : LmsExamAttempt::STATUS_SUBMITTED,
                'submitted_at' => now(),
                'duration_seconds' => $durationSeconds,
                'score_percent' => $score,
                'topic_scores_json' => json_encode($this->pctMap($topicHits, $topicTotal)),
                'competency_scores_json' => json_encode($this->pctMap($compHits, $compTotal)),
                'submission_reason' => $expired ? 'time_expired' : 'submitted',
                'unanswered_count' => $unanswered,
            ]);

        if ($updated === 0) {
            return $this->show(User::query()->findOrFail($attempt->user_id), $attempt->fresh());
        }

        return $this->show(User::query()->findOrFail($attempt->user_id), $attempt->fresh());
    }

    /** @return list<string> */
    private function labelList(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        return collect($raw)->map(function ($row) {
            if (is_string($row) && $row !== '') {
                return $row;
            }
            if (is_array($row)) {
                return (string) ($row['name'] ?? $row['key'] ?? $row['id'] ?? '');
            }

            return '';
        })->filter()->values()->all();
    }

    /** @param array<string,int> $hits @param array<string,int> $total */
    private function pctMap(array $hits, array $total): array
    {
        $out = [];
        foreach ($total as $id => $n) {
            $out[(string) $id] = (int) round(($hits[$id] ?? 0) / max(1, $n) * 100);
        }

        return $out;
    }

    /** @return array<string, mixed> */
    private function attemptMeta(LmsExamAttempt $attempt, LmsExamTemplate $template): array
    {
        $answers = $attempt->relationLoaded('answers') ? $attempt->answers : $attempt->answers()->get();
        $correct = $answers->where('is_correct', true)->count();
        $incorrect = $answers->filter(fn ($a) => $a->is_correct === false && $a->selected_option_id !== null)->count();
        $attemptNumber = LmsExamAttempt::query()
            ->where('user_id', $attempt->user_id)
            ->where('exam_template_id', $attempt->exam_template_id)
            ->whereIn('status', [LmsExamAttempt::STATUS_SUBMITTED, LmsExamAttempt::STATUS_EXPIRED_SUBMITTED])
            ->where('id', '<=', $attempt->id)
            ->count();
        $topic = $attempt->topic_scores_json ?: [];
        $comp = $attempt->competency_scores_json ?: [];

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
            'correct' => $attempt->status === LmsExamAttempt::STATUS_IN_PROGRESS ? null : $correct,
            'incorrect' => $attempt->status === LmsExamAttempt::STATUS_IN_PROGRESS ? null : $incorrect,
            'unanswered' => $attempt->unanswered_count,
            'time_used_seconds' => $attempt->duration_seconds,
            'total_duration_seconds' => ((int) $template->duration_minutes) * 60,
            'attempt_number' => max(1, $attemptNumber ?: 1),
            'submission_reason' => $attempt->submission_reason,
            'topic_scores' => $topic === [] ? null : $topic,
            'competency_scores' => $comp === [] ? null : $comp,
            'readiness_label' => 'Practice readiness — not an official pass prediction',
            'performance_label' => $this->performanceLabel($attempt->score_percent),
            'template' => [
                'id' => $template->id,
                'name' => $template->name,
                'duration_minutes' => $template->duration_minutes,
                'total_questions' => $template->total_questions,
                'allow_navigation' => $template->allow_navigation,
                'allow_review' => $template->allow_review,
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

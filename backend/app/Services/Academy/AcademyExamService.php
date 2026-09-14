<?php

namespace App\Services\Academy;

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
        $this->access->assertAcademySurface($user);
        if (! $template->isPublished()) {
            abort(404);
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

        $set = $this->buildQuestionSet($template);
        $started = now();

        return AcademyExamAttempt::query()->create([
            'user_id' => $user->id,
            'exam_template_id' => $template->id,
            'exam_template_version' => $template->version_number,
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
        $reveal = ! in_array($attempt->status, [AcademyExamAttempt::STATUS_IN_PROGRESS], true);

        $questions = collect($attempt->question_set_json)->map(function (array $item, int $index) use ($template, $answers, $reveal) {
            $version = AcademyQuestionVersion::query()->findOrFail($item['question_version_id']);
            $payload = $this->payload->learnerQuestion($version, (bool) $template->randomize_options && ! $reveal, $reveal);
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

    /** @return list<array{question_id:int,question_version_id:int,type:string}> */
    private function buildQuestionSet(AcademyExamTemplate $template): array
    {
        $independent = $this->publishedOfType('independent_mcq');
        $caseBased = $this->publishedOfType('case_mcq');

        if ($independent->count() < $template->independent_count || $caseBased->count() < $template->case_based_count) {
            abort(422, 'Not enough published questions to build this exam template.');
        }

        $picked = $independent->shuffle()->take($template->independent_count)
            ->concat($caseBased->shuffle()->take($template->case_based_count));

        if ($template->randomize_questions) {
            $picked = $picked->shuffle();
        }

        return $picked->map(fn (AcademyQuestion $q) => [
            'question_id' => $q->id,
            'question_version_id' => $q->current_published_version_id,
            'type' => $q->type,
        ])->values()->all();
    }

    private function publishedOfType(string $type)
    {
        return AcademyQuestion::query()
            ->where('status', 'published')
            ->where('type', $type)
            ->whereNotNull('current_published_version_id')
            ->get();
    }

    private function score(AcademyExamAttempt $attempt, bool $expired): array
    {
        $attempt->load('answers');
        $independentCorrect = $independentTotal = $caseCorrect = $caseTotal = 0;
        $topicHits = $topicTotal = $compHits = $compTotal = [];

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
        }

        $total = max(1, count($attempt->question_set_json));
        $correct = $independentCorrect + $caseCorrect;
        $score = (int) round($correct / $total * 100);
        $durationSeconds = (int) round($attempt->started_at?->diffInSeconds(now()) ?? 0);

        $attempt->update([
            'status' => $expired ? AcademyExamAttempt::STATUS_EXPIRED_SUBMITTED : AcademyExamAttempt::STATUS_SUBMITTED,
            'submitted_at' => now(),
            'duration_seconds' => $durationSeconds,
            'score_percent' => $score,
            'independent_score_percent' => $independentTotal ? (int) round($independentCorrect / $independentTotal * 100) : null,
            'case_score_percent' => $caseTotal ? (int) round($caseCorrect / $caseTotal * 100) : null,
            'topic_scores_json' => $this->pctMap($topicHits, $topicTotal),
            'competency_scores_json' => $this->pctMap($compHits, $compTotal),
            'time_analysis_json' => [
                'duration_seconds' => $durationSeconds,
                'expired' => $expired,
            ],
            'readiness_score' => $this->analytics->readinessForUser((int) $attempt->user_id, $score),
        ]);

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
        return [
            'id' => $attempt->id,
            'status' => $attempt->status,
            'started_at' => $attempt->started_at?->toIso8601String(),
            'expires_at' => $attempt->expires_at?->toIso8601String(),
            'server_now' => now()->toIso8601String(),
            'submitted_at' => $attempt->submitted_at?->toIso8601String(),
            'score_percent' => $attempt->score_percent,
            'independent_score_percent' => $attempt->independent_score_percent,
            'case_score_percent' => $attempt->case_score_percent,
            'topic_scores' => $attempt->topic_scores_json,
            'competency_scores' => $attempt->competency_scores_json,
            'readiness_score' => $attempt->readiness_score,
            'readiness_label' => 'Exam Readiness Score — not an official pass prediction',
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
}

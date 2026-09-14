<?php

namespace App\Services\Academy;

use App\Models\Academy\AcademyPracticeSession;
use App\Models\Academy\AcademyQuestion;
use App\Models\Academy\AcademyQuestionAttempt;
use App\Models\Academy\AcademyQuestionVersion;
use App\Models\User;
use Illuminate\Support\Collection;

class AcademyPracticeService
{
    public function __construct(
        private AcademyAccess $access,
        private AcademyPayload $payload,
    ) {}

    public function start(User $user, array $filters): AcademyPracticeSession
    {
        $this->access->assertAcademySurface($user);
        $count = min((int) ($filters['count'] ?? 10), (int) config('academy.practice_max_questions', 100));
        $count = max(1, $count);

        $versions = $this->filteredPublished($user, $filters, $count);
        if ($versions->isEmpty()) {
            abort(422, 'No published questions match those filters.');
        }

        return AcademyPracticeSession::query()->create([
            'user_id' => $user->id,
            'filters_json' => $filters,
            'question_count' => $versions->count(),
            'explain_mode' => $filters['explain_mode'] ?? 'explain_immediately',
            'status' => 'in_progress',
            'question_set_json' => $versions->map(fn (AcademyQuestionVersion $v) => [
                'question_id' => $v->question_id,
                'question_version_id' => $v->id,
            ])->values()->all(),
            'started_at' => now(),
        ]);
    }

    public function show(User $user, AcademyPracticeSession $session, bool $includeAnswers = false): array
    {
        $this->access->assertOwnUser($user, (int) $session->user_id);
        $answered = AcademyQuestionAttempt::query()
            ->where('practice_session_id', $session->id)
            ->get()
            ->keyBy('question_id');

        $revealAll = $includeAnswers || $session->status === 'completed' || $session->explain_mode === 'explain_after_set' && $session->status === 'completed';

        $questions = collect($session->question_set_json)->map(function (array $item) use ($session, $answered, $revealAll) {
            $version = AcademyQuestionVersion::query()->findOrFail($item['question_version_id']);
            $attempt = $answered->get($item['question_id']);
            $reveal = $revealAll || ($session->explain_mode === 'explain_immediately' && $attempt);
            $payload = $this->payload->learnerQuestion($version, false, (bool) $reveal);
            $payload['answered'] = (bool) $attempt;
            if ($attempt && $reveal) {
                $payload['selected_option_id'] = $attempt->selected_option_id;
                $payload['is_correct'] = $attempt->is_correct;
            } elseif ($attempt) {
                $payload['selected_option_id'] = $attempt->selected_option_id;
            }

            return $payload;
        });

        return [
            'session' => [
                'id' => $session->id,
                'explain_mode' => $session->explain_mode,
                'status' => $session->status,
                'question_count' => $session->question_count,
            ],
            'questions' => $questions,
        ];
    }

    public function answer(User $user, AcademyPracticeSession $session, int $questionId, int $optionId, ?string $confidence = null, ?int $seconds = null): array
    {
        $this->access->assertOwnUser($user, (int) $session->user_id);
        if ($session->status !== 'in_progress') {
            abort(422, 'This practice session is closed.');
        }

        $item = collect($session->question_set_json)->firstWhere('question_id', $questionId);
        if (! $item) {
            abort(404);
        }

        $version = AcademyQuestionVersion::query()->with('options')->findOrFail($item['question_version_id']);
        $correctId = $version->options->firstWhere('is_correct', true)?->id;
        $isCorrect = (int) $correctId === (int) $optionId;

        $attempt = AcademyQuestionAttempt::query()->updateOrCreate(
            [
                'practice_session_id' => $session->id,
                'user_id' => $user->id,
                'question_id' => $questionId,
            ],
            [
                'question_version_id' => $version->id,
                'selected_option_id' => $optionId,
                'is_correct' => $isCorrect,
                'time_spent_seconds' => $seconds,
                'mode' => 'practice',
                'confidence' => $confidence,
                'attempted_at' => now(),
            ]
        );

        $answered = AcademyQuestionAttempt::query()->where('practice_session_id', $session->id)->count();
        if ($answered >= $session->question_count) {
            $session->update(['status' => 'completed', 'completed_at' => now()]);
        }

        $reveal = $session->explain_mode === 'explain_immediately' || $session->fresh()->status === 'completed';
        $payload = $this->payload->learnerQuestion($version, false, $reveal);
        if ($reveal) {
            $payload['selected_option_id'] = $optionId;
            $payload['is_correct'] = $isCorrect;
        } else {
            $payload['selected_option_id'] = $optionId;
        }

        return ['attempt' => $attempt, 'question' => $payload, 'session' => $session->fresh()];
    }

    /** @return Collection<int, AcademyQuestionVersion> */
    private function filteredPublished(User $user, array $filters, int $count): Collection
    {
        $query = AcademyQuestion::query()
            ->where('status', 'published')
            ->whereNotNull('current_published_version_id');

        if (! empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        $questionIds = $query->pluck('id');
        $versions = AcademyQuestionVersion::query()
            ->with(['options', 'topics', 'competencies', 'question'])
            ->whereIn('id', AcademyQuestion::query()->whereIn('id', $questionIds)->pluck('current_published_version_id'))
            ->get();

        if (! empty($filters['topic_id'])) {
            $versions = $versions->filter(fn ($v) => $v->topics->contains('id', (int) $filters['topic_id']));
        }
        if (! empty($filters['competency_id'])) {
            $versions = $versions->filter(fn ($v) => $v->competencies->contains('id', (int) $filters['competency_id']));
        }
        if (! empty($filters['difficulty'])) {
            $versions = $versions->where('difficulty', $filters['difficulty']);
        }
        if (! empty($filters['division'])) {
            $versions = $versions->filter(fn ($v) => $v->topics->contains('division', $filters['division']));
        }
        if (! empty($filters['incorrect_only'])) {
            $wrong = AcademyQuestionAttempt::query()
                ->where('user_id', $user->id)
                ->where('is_correct', false)
                ->pluck('question_id');
            $versions = $versions->whereIn('question_id', $wrong);
        }
        if (! empty($filters['unanswered_only'])) {
            $seen = AcademyQuestionAttempt::query()->where('user_id', $user->id)->pluck('question_id');
            $versions = $versions->whereNotIn('question_id', $seen);
        }

        return $versions->shuffle()->take($count)->values();
    }
}

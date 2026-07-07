<?php

namespace App\Services;

use App\Models\Lms\LmsQuestion;
use App\Models\Lms\LmsQuestionBank;
use App\Models\Lms\LmsQuiz;
use App\Models\Lms\LmsQuizAttempt;
use Illuminate\Support\Collection;

class LmsExamService
{
    /** @return Collection<int, array<string, mixed>> */
    public function resolveQuestionsForQuiz(LmsQuiz $quiz, ?int $seed = null): Collection
    {
        if ($quiz->source_mode === 'bank_random') {
            $count = max(1, (int) ($quiz->random_question_count ?? 10));
            $query = LmsQuestionBank::with('options')
                ->where('course_id', $quiz->course_id);

            $pool = $query->get();
            if ($pool->count() <= $count) {
                return $pool->values()->map(fn ($q) => $this->formatBankQuestion($q));
            }

            return $this->deterministicSample($pool, $count, $seed ?? 0)
                ->map(fn ($q) => $this->formatBankQuestion($q));
        }

        if ($quiz->source_mode === 'bank_fixed') {
            $quiz->load(['bankLinks.bankQuestion.options']);

            return $quiz->bankLinks
                ->map(fn ($link) => $this->formatBankQuestion($link->bankQuestion))
                ->filter();
        }

        $quiz->load(['questions.options']);

        return $quiz->questions->map(fn ($q) => $this->formatInlineQuestion($q));
    }

    public function formatBankQuestion(LmsQuestionBank $q): array
    {
        return [
            'id'            => $q->id,
            'source'        => 'bank',
            'question_text' => $q->question_text,
            'topic'         => $q->topic,
            'explanation'   => $q->explanation,
            'options'       => $q->options->map(fn ($o) => [
                'id'          => $o->id,
                'option_text' => $o->option_text,
            ])->values()->all(),
            '_correct_option_id' => $q->options->firstWhere('is_correct', true)?->id,
        ];
    }

    public function formatInlineQuestion(LmsQuestion $q): array
    {
        return [
            'id'            => $q->id,
            'source'        => 'inline',
            'question_text' => $q->question_text,
            'topic'         => null,
            'explanation'   => null,
            'options'       => $q->options->map(fn ($o) => [
                'id'          => $o->id,
                'option_text' => $o->option_text,
            ])->values()->all(),
            '_correct_option_id' => $q->options->firstWhere('is_correct', true)?->id,
        ];
    }

    /** Client-facing payload (no correct answers). */
    public function clientQuestionsPayload(Collection $questions, LmsQuiz $quiz): array
    {
        return [
            'id'                 => $quiz->id,
            'title'              => $quiz->title,
            'content_type'       => $quiz->content_type,
            'passing_score'      => $quiz->passing_score,
            'time_limit_minutes' => $quiz->time_limit_minutes,
            'description'        => $quiz->description,
            'question_count'     => $questions->count(),
            'questions'          => $questions->map(fn ($q) => [
                'id'            => $q['id'],
                'source'        => $q['source'],
                'question_text' => $q['question_text'],
                'topic'         => $q['topic'],
                'options'       => $q['options'],
            ])->values()->all(),
        ];
    }

    /**
     * @param  array<int|string, int>  $answers  keys: question id, values: option id
     */
    public function grade(LmsQuiz $quiz, Collection $questions, array $answers): array
    {
        $answers = $this->normalizeAnswers($answers);
        $total   = $questions->count();
        $correct = 0;
        $breakdown = [];

        foreach ($questions as $q) {
            $qid       = (int) $q['id'];
            $selected  = $answers[$qid] ?? null;
            $right     = isset($q['_correct_option_id']) ? (int) $q['_correct_option_id'] : null;
            $isCorrect = $right !== null && $selected !== null && $selected === $right;
            if ($isCorrect) {
                $correct++;
            }

            $selectedOpt = $this->findOption($q['options'] ?? [], $selected);
            $correctOpt  = $this->findOption($q['options'] ?? [], $right);

            $breakdown[] = [
                'question_id'        => $qid,
                'source'             => $q['source'],
                'question_text'      => $q['question_text'],
                'topic'              => $q['topic'],
                'selected_option_id' => $selected,
                'selected_text'      => $selectedOpt['option_text'] ?? null,
                'correct_option_id'  => $right,
                'correct_text'       => $correctOpt['option_text'] ?? null,
                'is_correct'         => $isCorrect,
                'explanation'        => $q['explanation'] ?? null,
            ];
        }

        $score  = $total > 0 ? (int) round(($correct / $total) * 100) : 0;
        $passed = $score >= $quiz->passing_score;

        return [
            'score_percent' => $score,
            'passed'        => $passed,
            'correct'       => $correct,
            'total'         => $total,
            'breakdown'     => $breakdown,
        ];
    }

    public function snapshotForStorage(Collection $questions): array
    {
        return $questions->map(fn ($q) => [
            'id'                 => $q['id'],
            'source'             => $q['source'],
            'question_text'      => $q['question_text'],
            'topic'              => $q['topic'],
            'explanation'        => $q['explanation'],
            'options'            => $q['options'],
            'correct_option_id'  => $q['_correct_option_id'],
        ])->values()->all();
    }

    public function attemptResultPayload(LmsQuizAttempt $attempt): array
    {
        $snapshot = collect($attempt->questions_snapshot_json ?? []);
        $answers  = $this->normalizeAnswers($attempt->answers_json ?? []);

        $breakdown = $snapshot->map(function ($q) use ($answers) {
            $qid       = (int) $q['id'];
            $selected  = $answers[$qid] ?? null;
            $right     = isset($q['correct_option_id']) ? (int) $q['correct_option_id'] : null;
            $isCorrect = $right !== null && $selected !== null && $selected === $right;

            $options     = $q['options'] ?? [];
            $selectedOpt = $this->findOption($options, $selected);
            $correctOpt  = $this->findOption($options, $right);

            return [
                'question_id'        => $qid,
                'question_text'      => $q['question_text'],
                'topic'              => $q['topic'] ?? null,
                'selected_text'      => $selectedOpt['option_text'] ?? null,
                'correct_text'       => $correctOpt['option_text'] ?? null,
                'is_correct'         => $isCorrect,
                'explanation'        => $q['explanation'] ?? null,
            ];
        })->values()->all();

        $correctCount = collect($breakdown)->where('is_correct', true)->count();

        return [
            'id'                 => $attempt->id,
            'quiz_id'            => $attempt->quiz_id,
            'quiz_title'         => $attempt->quiz?->title,
            'content_type'       => $attempt->quiz?->content_type,
            'score_percent'      => $attempt->score_percent,
            'passed'             => $attempt->passed,
            'correct'            => $correctCount,
            'total'              => count($breakdown),
            'attempted_at'       => $attempt->attempted_at,
            'time_taken_seconds' => $attempt->time_taken_seconds,
            'breakdown'          => $breakdown,
        ];
    }

    /**
     * Pick the same questions for a given seed on every request (show + submit + review).
     *
     * @param  Collection<int, LmsQuestionBank>  $pool
     */
    private function deterministicSample(Collection $pool, int $count, int $seed): Collection
    {
        return $pool
            ->sortBy(fn ($item) => hash('sha256', $seed.':'.$item->id))
            ->take($count)
            ->values();
    }

    /** @param  array<int|string, mixed>  $answers */
    private function normalizeAnswers(array $answers): array
    {
        $normalized = [];
        foreach ($answers as $questionId => $optionId) {
            if ($optionId === null || $optionId === '') {
                continue;
            }
            $normalized[(int) $questionId] = (int) $optionId;
        }

        return $normalized;
    }

    /** @param  list<array<string, mixed>>  $options */
    private function findOption(array $options, ?int $optionId): ?array
    {
        if ($optionId === null) {
            return null;
        }

        foreach ($options as $opt) {
            if ((int) ($opt['id'] ?? 0) === $optionId) {
                return $opt;
            }
        }

        return null;
    }
}

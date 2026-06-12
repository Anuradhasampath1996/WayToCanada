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
                return $pool->shuffle()->map(fn ($q) => $this->formatBankQuestion($q));
            }

            if ($seed !== null) {
                mt_srand($seed);
            }

            return $pool->random($count)->values()->map(fn ($q) => $this->formatBankQuestion($q));
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
        $total   = $questions->count();
        $correct = 0;
        $breakdown = [];

        foreach ($questions as $q) {
            $qid      = $q['id'];
            $selected = isset($answers[$qid]) ? (int) $answers[$qid] : null;
            $right    = $q['_correct_option_id'] ?? null;
            $isCorrect = $right && $selected === (int) $right;
            if ($isCorrect) {
                $correct++;
            }

            $selectedOpt = collect($q['options'])->firstWhere('id', $selected);
            $correctOpt  = collect($q['options'])->firstWhere('id', $right);

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
        $answers  = $attempt->answers_json ?? [];

        $breakdown = $snapshot->map(function ($q) use ($answers) {
            $qid      = $q['id'];
            $selected = isset($answers[$qid]) ? (int) $answers[$qid] : null;
            $right    = $q['correct_option_id'] ?? null;
            $isCorrect = $right && $selected === (int) $right;

            $options = collect($q['options'] ?? []);
            $selectedOpt = $options->firstWhere('id', $selected);
            $correctOpt  = $options->firstWhere('id', $right);

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

        return [
            'id'                 => $attempt->id,
            'quiz_id'            => $attempt->quiz_id,
            'quiz_title'         => $attempt->quiz?->title,
            'content_type'       => $attempt->quiz?->content_type,
            'score_percent'      => $attempt->score_percent,
            'passed'             => $attempt->passed,
            'attempted_at'       => $attempt->attempted_at,
            'time_taken_seconds' => $attempt->time_taken_seconds,
            'breakdown'          => $breakdown,
        ];
    }
}

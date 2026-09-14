<?php

namespace App\Services\Academy;

use App\Models\Academy\AcademyQuestion;
use App\Models\Academy\AcademyQuestionOption;
use App\Models\Academy\AcademyQuestionVersion;
use App\Models\User;

class AcademyQuestionService
{
    public function createDraft(array $data, User $actor): AcademyQuestion
    {
        $question = AcademyQuestion::query()->create([
            'type' => $data['type'],
            'status' => 'draft',
            'created_by' => $actor->id,
        ]);

        $version = AcademyQuestionVersion::query()->create([
            'question_id' => $question->id,
            'version_number' => 1,
            'question_text' => $data['question_text'],
            'explanation' => $data['explanation'] ?? null,
            'difficulty' => $data['difficulty'] ?? 'medium',
            'case_version_id' => $data['case_version_id'] ?? null,
            'status' => 'draft',
            'author_user_id' => $actor->id,
        ]);

        $this->syncOptions($version, $data['options'] ?? []);
        if (! empty($data['topic_ids'])) {
            $version->topics()->sync($data['topic_ids']);
        }
        if (! empty($data['competency_ids'])) {
            $version->competencies()->sync($data['competency_ids']);
        }

        return $question->fresh('versions.options');
    }

    public function newDraftFromPublished(AcademyQuestion $question, User $actor): AcademyQuestionVersion
    {
        $published = $question->publishedVersion()->with(['options', 'topics', 'competencies'])->firstOrFail();
        $version = AcademyQuestionVersion::query()->create([
            'question_id' => $question->id,
            'version_number' => (int) $question->versions()->max('version_number') + 1,
            'question_text' => $published->question_text,
            'explanation' => $published->explanation,
            'difficulty' => $published->difficulty,
            'case_version_id' => $published->case_version_id,
            'status' => 'draft',
            'author_user_id' => $actor->id,
        ]);
        $this->syncOptions($version, $published->options->map(fn ($o) => [
            'option_key' => $o->option_key,
            'option_text' => $o->option_text,
            'is_correct' => $o->is_correct,
            'incorrect_explanation' => $o->incorrect_explanation,
        ])->all());
        $version->topics()->sync($published->topics->pluck('id'));
        $version->competencies()->sync($published->competencies->pluck('id'));

        return $version->fresh('options');
    }

    public function publish(AcademyQuestion $question, AcademyQuestionVersion $version, User $actor, AcademyWorkflow $workflow, bool $override = false): void
    {
        $workflow->transition($version, 'published', $actor, null, $override);
        $question->update([
            'status' => 'published',
            'current_published_version_id' => $version->id,
        ]);
    }

    /** @param list<array<string, mixed>> $options */
    public function syncOptions(AcademyQuestionVersion $version, array $options): void
    {
        $version->options()->delete();
        foreach (array_values($options) as $i => $option) {
            AcademyQuestionOption::query()->create([
                'question_version_id' => $version->id,
                'option_key' => $option['option_key'] ?? chr(65 + $i),
                'option_text' => $option['option_text'],
                'is_correct' => (bool) ($option['is_correct'] ?? false),
                'incorrect_explanation' => $option['incorrect_explanation'] ?? null,
                'sort_order' => $i,
            ]);
        }
    }
}

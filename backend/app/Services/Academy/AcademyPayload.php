<?php

namespace App\Services\Academy;

use App\Models\Academy\AcademyCaseVersion;
use App\Models\Academy\AcademyContentSourceLink;
use App\Models\Academy\AcademyLegalSource;
use App\Models\Academy\AcademyQuestionOption;
use App\Models\Academy\AcademyQuestionVersion;

class AcademyPayload
{
    /** @return array<string, mixed> */
    public function learnerQuestion(AcademyQuestionVersion $version, bool $shuffleOptions = false, bool $reveal = false): array
    {
        $version->loadMissing(['options', 'question', 'topics', 'competencies', 'caseVersion.exhibits']);
        $options = $version->options;
        if ($shuffleOptions) {
            $options = $options->shuffle()->values();
        }

        $payload = [
            'id' => $version->question_id,
            'version_id' => $version->id,
            'type' => $version->question->type,
            'question_text' => $version->question_text,
            'difficulty' => $version->difficulty,
            'topics' => $version->topics->map(fn ($t) => ['id' => $t->id, 'key' => $t->key, 'name' => $t->name, 'division' => $t->division])->values(),
            'competencies' => $version->competencies->map(fn ($c) => ['id' => $c->id, 'key' => $c->key, 'name' => $c->name])->values(),
            'case' => $version->caseVersion ? $this->learnerCase($version->caseVersion) : null,
            'options' => $options->map(fn (AcademyQuestionOption $o) => [
                'id' => $o->id,
                'option_key' => $o->option_key,
                'option_text' => $o->option_text,
            ])->values(),
        ];

        if ($reveal) {
            $correct = $version->options->firstWhere('is_correct', true);
            $payload['correct_option_id'] = $correct?->id;
            $payload['explanation'] = $version->explanation;
            $payload['option_explanations'] = $version->options
                ->where('is_correct', false)
                ->mapWithKeys(fn (AcademyQuestionOption $o) => [$o->id => $o->incorrect_explanation])
                ->all();
            $payload['citations'] = $this->citations('question_version', $version->id);
        }

        return $payload;
    }

    /** @return array<string, mixed> */
    public function learnerCase(AcademyCaseVersion $version): array
    {
        $version->loadMissing(['case', 'exhibits']);

        return [
            'case_id' => $version->case_id,
            'case_version_id' => $version->id,
            'title' => $version->case->title,
            'client_profile' => $version->client_profile_json,
            'immigration_history' => $version->immigration_history,
            'facts' => $version->facts,
            'procedural_history' => $version->procedural_history,
            'tribunal_info' => $version->tribunal_info,
            'legal_issues' => $version->legal_issues_json,
            'exhibits' => $version->exhibits->map(fn ($e) => [
                'id' => $e->id,
                'title' => $e->title,
                'exhibit_type' => $e->exhibit_type,
                'body_html' => $e->body_html,
                'file_url' => $e->file_url,
            ])->values(),
        ];
    }

    /** @return list<array<string, mixed>> */
    public function citations(string $type, int $id): array
    {
        $links = AcademyContentSourceLink::query()
            ->where('linkable_type', $type)
            ->where('linkable_id', $id)
            ->get();

        if ($links->isEmpty()) {
            return [];
        }

        $sources = AcademyLegalSource::query()
            ->whereIn('id', $links->pluck('legal_source_id'))
            ->whereIn('status', ['published', 'outdated'])
            ->get()
            ->keyBy('id');

        return $links->map(function ($link) use ($sources) {
            $source = $sources->get($link->legal_source_id);
            if (! $source) {
                return null;
            }

            return [
                'title' => $source->title,
                'organization' => $source->source_organization,
                'url' => $source->source_url,
                'section' => $link->section_label,
                'last_verified_at' => optional($source->last_verified_at)?->toDateString(),
                'disclaimer' => config('academy.disclaimer'),
            ];
        })->filter()->values()->all();
    }
}

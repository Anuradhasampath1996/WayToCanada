<?php

namespace App\Services\Academy\Ai\Providers;

use App\Models\Academy\AcademyAiGenerationJob;
use App\Services\Academy\Ai\AcademyAiPromptCatalog;
use App\Services\Academy\Ai\AcademyAiSchemas;
use App\Services\Academy\Ai\AcademyAiUsageService;
use App\Services\Academy\Ai\Contracts\AcademyResearchProvider;
use App\Services\Academy\Ai\Dto\ResearchNotes;
use App\Services\Academy\Ai\OpenAi\OpenAiResponsesClient;

class OpenAiAcademyResearchProvider implements AcademyResearchProvider
{
    public function __construct(
        private OpenAiResponsesClient $client,
        private AcademyAiUsageService $usage,
    ) {}

    public function configured(): bool
    {
        return $this->client->configured();
    }

    public function name(): string
    {
        return 'openai';
    }

    public function research(AcademyAiGenerationJob $job, array $task): ResearchNotes
    {
        $model = (string) config('academy_ai.openai.fast_model');
        $result = $this->client->structured(
            $model,
            'research_notes',
            AcademyAiSchemas::researchNotes(),
            AcademyAiPromptCatalog::system('research_notes'),
            (string) ($task['prompt'] ?? 'Identify official Canadian sources for this Academy generation request.'),
        );
        $this->usage->recordStructured($job->id, 'research', $result, AcademyAiPromptCatalog::version('research_notes'));
        $notes = ResearchNotes::fromArray($result->data, 'openai');
        $notes->providerRequestId = $result->requestId;

        return $notes;
    }
}

<?php

namespace App\Services\Academy\Ai\Providers;

use App\Models\Academy\AcademyAiGenerationJob;
use App\Services\Academy\Ai\Contracts\AcademyResearchProvider;
use App\Services\Academy\Ai\Dto\ResearchNotes;

class FakeAcademyResearchProvider implements AcademyResearchProvider
{
    /** @var list<array<string, mixed>> */
    public array $candidateSources = [];

    public function configured(): bool
    {
        return true;
    }

    public function name(): string
    {
        return 'fake';
    }

    public function research(AcademyAiGenerationJob $job, array $task): ResearchNotes
    {
        $candidates = $this->candidateSources ?: [[
            'title' => 'IRPA',
            'url' => 'https://laws-lois.justice.gc.ca/eng/acts/I-2.5/',
            'organization' => 'Department of Justice',
            'excerpt' => 'Refugee protection provisions.',
            'why_relevant' => 'Official statute',
        ]];

        return new ResearchNotes(
            notes: 'Fake research notes for job '.$job->id,
            candidateSources: $candidates,
            changedMaterialFlags: [],
            secondaryOnly: true,
            provider: 'fake',
        );
    }
}

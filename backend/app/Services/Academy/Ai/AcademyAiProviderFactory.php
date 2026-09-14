<?php

namespace App\Services\Academy\Ai;

use App\Services\Academy\Ai\Contracts\AcademyGenerationProvider;
use App\Services\Academy\Ai\Contracts\AcademyResearchProvider;
use App\Services\Academy\Ai\Providers\FakeAcademyGenerationProvider;
use App\Services\Academy\Ai\Providers\FakeAcademyResearchProvider;
use App\Services\Academy\Ai\Providers\ManusAcademyResearchProvider;
use App\Services\Academy\Ai\Providers\OpenAiAcademyGenerationProvider;
use App\Services\Academy\Ai\Providers\OpenAiAcademyResearchProvider;

class AcademyAiProviderFactory
{
    public function research(): AcademyResearchProvider
    {
        $driver = (string) config('academy_ai.research_driver', 'auto');
        if ($driver === 'fake') {
            return app(FakeAcademyResearchProvider::class);
        }
        if ($driver === 'manus') {
            return app(ManusAcademyResearchProvider::class);
        }
        if ($driver === 'openai') {
            return app(OpenAiAcademyResearchProvider::class);
        }

        $manus = app(ManusAcademyResearchProvider::class);
        if ($manus->configured()) {
            return $manus;
        }

        return app(OpenAiAcademyResearchProvider::class);
    }

    public function generation(): AcademyGenerationProvider
    {
        $driver = (string) config('academy_ai.generation_driver', 'auto');
        if ($driver === 'fake') {
            return app(FakeAcademyGenerationProvider::class);
        }

        return app(OpenAiAcademyGenerationProvider::class);
    }

    public function manusConfigured(): bool
    {
        return app(ManusAcademyResearchProvider::class)->configured();
    }
}

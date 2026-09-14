<?php

namespace App\Services\Academy\Ai\Contracts;

use App\Models\Academy\AcademyAiGenerationJob;
use App\Services\Academy\Ai\Dto\ResearchNotes;

interface AcademyResearchProvider
{
    public function configured(): bool;

    public function name(): string;

    public function research(AcademyAiGenerationJob $job, array $task): ResearchNotes;
}

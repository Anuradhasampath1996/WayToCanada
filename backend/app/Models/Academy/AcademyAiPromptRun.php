<?php

namespace App\Models\Academy;

class AcademyAiPromptRun extends AcademyModel
{
    protected $table = 'academy_ai_prompt_runs';

    protected $fillable = [
        'generation_job_id', 'step_id', 'prompt_key', 'prompt_version', 'prompt_hash',
    ];
}

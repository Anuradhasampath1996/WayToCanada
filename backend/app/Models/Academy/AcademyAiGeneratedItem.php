<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AcademyAiGeneratedItem extends AcademyModel
{
    protected $table = 'academy_ai_generated_items';

    protected $fillable = [
        'generation_job_id', 'item_type', 'idempotency_key', 'status', 'payload_json',
        'entity_type', 'entity_id', 'prompt_key', 'prompt_version', 'provider',
        'model', 'citation_unverified', 'admin_label',
    ];

    protected function casts(): array
    {
        return [
            'payload_json' => 'array',
            'citation_unverified' => 'boolean',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(AcademyAiGenerationJob::class, 'generation_job_id');
    }

    public function validation(): HasOne
    {
        return $this->hasOne(AcademyAiValidationResult::class, 'generated_item_id');
    }
}

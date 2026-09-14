<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class LmsAiGeneratedItem extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_ai_generated_items';

    protected $fillable = [
        'generation_job_id', 'item_type', 'idempotency_key', 'status', 'payload_json',
        'entity_type', 'entity_id', 'prompt_key', 'prompt_version', 'provider', 'model',
        'citation_unverified', 'admin_label',
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
        return $this->belongsTo(LmsAiGenerationJob::class, 'generation_job_id');
    }

    public function validation(): HasOne
    {
        return $this->hasOne(LmsAiValidationResult::class, 'generated_item_id');
    }
}

<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LmsAiValidationResult extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_ai_validation_results';

    protected $fillable = [
        'generated_item_id', 'structural_ok', 'grounding_ok', 'agrees_with_generated',
        'ambiguous', 'flags_json', 'validator_payload_json', 'validator_model',
    ];

    protected function casts(): array
    {
        return [
            'structural_ok' => 'boolean',
            'grounding_ok' => 'boolean',
            'agrees_with_generated' => 'boolean',
            'ambiguous' => 'boolean',
            'flags_json' => 'array',
            'validator_payload_json' => 'array',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(LmsAiGeneratedItem::class, 'generated_item_id');
    }
}

<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyAiValidationResult extends AcademyModel
{
    protected $table = 'academy_ai_validation_results';

    protected $fillable = [
        'generated_item_id', 'structural_ok', 'grounding_ok', 'agrees_with_generated',
        'ambiguous', 'currency_ok', 'validator_option_key', 'generated_option_key',
        'source_grounding_score', 'answer_consistency_score', 'ambiguity_score',
        'citation_coverage_score', 'admin_label', 'flags_json', 'validator_payload_json',
        'validator_model',
    ];

    protected function casts(): array
    {
        return [
            'structural_ok' => 'boolean',
            'grounding_ok' => 'boolean',
            'agrees_with_generated' => 'boolean',
            'ambiguous' => 'boolean',
            'currency_ok' => 'boolean',
            'source_grounding_score' => 'float',
            'answer_consistency_score' => 'float',
            'ambiguity_score' => 'float',
            'citation_coverage_score' => 'float',
            'flags_json' => 'array',
            'validator_payload_json' => 'array',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(AcademyAiGeneratedItem::class, 'generated_item_id');
    }
}

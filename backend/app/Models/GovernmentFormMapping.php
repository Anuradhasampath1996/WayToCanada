<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GovernmentFormMapping extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'government_form_version_id',
        'canonical_key',
        'pdf_field_path',
        'field_type',
        'transformer',
        'is_required',
        'conditional_rule',
        'repeatable_group',
        'sort_order',
        'mapping_version',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'is_required'      => 'boolean',
            'conditional_rule' => 'array',
            'sort_order'       => 'integer',
        ];
    }

    public function formVersion(): BelongsTo
    {
        return $this->belongsTo(GovernmentFormVersion::class, 'government_form_version_id');
    }
}

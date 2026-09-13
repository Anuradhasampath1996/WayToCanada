<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CaseRequirementPlan extends Model
{
    public const STATUS_CURRENT = 'current';
    public const STATUS_SUPERSEDED = 'superseded';

    protected $connection = 'cws';

    protected $fillable = [
        'case_file_id',
        'pathway_requirement_definition_id',
        'plan_version',
        'registry_version',
        'registry_key',
        'pathway_code',
        'pathway_label',
        'status',
        'snapshot',
        'previous_plan_id',
        'created_by',
        'change_reason',
        'change_note',
    ];

    protected function casts(): array
    {
        return [
            'snapshot' => 'array',
            'plan_version' => 'integer',
            'registry_version' => 'integer',
        ];
    }

    public function caseFile(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function definition(): BelongsTo
    {
        return $this->belongsTo(PathwayRequirementDefinition::class, 'pathway_requirement_definition_id');
    }

    public function previousPlan(): BelongsTo
    {
        return $this->belongsTo(self::class, 'previous_plan_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

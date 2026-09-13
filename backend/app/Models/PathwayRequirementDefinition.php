<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PathwayRequirementDefinition extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'registry_key',
        'family',
        'version',
        'effective_from',
        'effective_to',
        'source_name',
        'source_reference',
        'last_verified_at',
        'definition',
        'is_published',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'datetime',
            'effective_to' => 'datetime',
            'last_verified_at' => 'datetime',
            'definition' => 'array',
            'is_published' => 'boolean',
        ];
    }

    public function plans(): HasMany
    {
        return $this->hasMany(CaseRequirementPlan::class);
    }

    public function isEffectiveAt($at = null): bool
    {
        $at = $at ? \Illuminate\Support\Carbon::parse($at) : now();
        if ($this->effective_from && $at->lt($this->effective_from)) {
            return false;
        }
        if ($this->effective_to && $at->gt($this->effective_to)) {
            return false;
        }

        return (bool) $this->is_published;
    }
}

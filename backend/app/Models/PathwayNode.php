<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PathwayNode extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'code',
        'parent_code',
        'label',
        'family',
        'assessment_branch',
        'package_leaf_preferences',
        'province_code',
        'community_code',
        'crs_backend_value',
        'retainer_fee',
        'retainer_description',
        'is_assignable',
        'is_popular',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'package_leaf_preferences' => 'array',
            'is_assignable' => 'boolean',
            'is_popular' => 'boolean',
            'is_active' => 'boolean',
            'retainer_fee' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_code', 'code');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_code', 'code')
            ->orderBy('sort_order')
            ->orderBy('label');
    }

    /** Human family label used by docs / hub (Express Entry, PNP, …). */
    public function hubFamilyLabel(): ?string
    {
        return match ($this->family) {
            'express_entry' => 'Express Entry',
            'pnp' => 'PNP',
            'family' => 'Family Sponsorship',
            'study' => 'Study Permit',
            'work' => 'Work Permit',
            'pilot' => 'Community Pilot',
            'quebec' => 'Quebec',
            'business' => 'Business Immigration',
            'visitor' => 'Visitor',
            'citizenship' => 'Citizenship',
            'pr_card' => 'PR Card',
            default => null,
        };
    }
}

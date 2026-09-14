<?php

namespace App\Models\Academy;

class AcademyEntitlement extends AcademyModel
{
    protected $table = 'academy_entitlements';

    protected $fillable = [
        'user_id', 'type', 'course_id', 'track_id', 'starts_at', 'ends_at', 'is_active', 'created_by', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function isCurrentlyActive(): bool
    {
        if (! $this->is_active) {
            return false;
        }
        if ($this->starts_at && $this->starts_at->isFuture()) {
            return false;
        }
        if ($this->ends_at && $this->ends_at->isPast()) {
            return false;
        }

        return true;
    }
}

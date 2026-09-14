<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyTopic extends AcademyModel
{
    protected $table = 'academy_topics';

    protected $fillable = ['track_id', 'parent_id', 'key', 'name', 'division', 'sort_order', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(AcademyLearningTrack::class, 'track_id');
    }
}

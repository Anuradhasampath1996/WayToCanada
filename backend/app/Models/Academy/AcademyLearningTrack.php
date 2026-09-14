<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademyLearningTrack extends AcademyModel
{
    protected $table = 'academy_learning_tracks';

    protected $fillable = ['key', 'name', 'description', 'sort_order', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function topics(): HasMany
    {
        return $this->hasMany(AcademyTopic::class, 'track_id');
    }

    public function courses(): HasMany
    {
        return $this->hasMany(AcademyCourse::class, 'track_id');
    }
}

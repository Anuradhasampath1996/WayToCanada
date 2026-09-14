<?php

namespace App\Models\Academy;

class AcademyContentReview extends AcademyModel
{
    public $timestamps = false;

    protected $table = 'academy_content_reviews';

    protected $fillable = [
        'reviewable_type', 'reviewable_id', 'from_status', 'to_status', 'actor_user_id', 'comment', 'created_at',
    ];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}

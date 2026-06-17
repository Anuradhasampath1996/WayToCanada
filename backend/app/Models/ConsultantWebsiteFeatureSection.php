<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ConsultantWebsiteFeatureSection extends Model
{
    protected $fillable = [
        'slug',
        'tag',
        'title',
        'subtitle',
        'description',
        'bullet_points',
        'icon',
        'media_type',
        'media_url',
        'mock_variant',
        'media_alt',
        'layout',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'bullet_points' => 'array',
        'is_active'     => 'boolean',
        'sort_order'    => 'integer',
    ];
}

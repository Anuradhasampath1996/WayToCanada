<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrccNews extends Model
{
    protected $table = 'ircc_news_cache';

    protected $fillable = [
        'guid',
        'title',
        'link',
        'description',
        'category',
        'published_at',
    ];

    protected $casts = [
        'published_at' => 'datetime',
    ];
}

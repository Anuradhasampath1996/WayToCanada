<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TeamPermissionPreset extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'key',
        'name',
        'description',
        'permissions',
    ];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
        ];
    }
}

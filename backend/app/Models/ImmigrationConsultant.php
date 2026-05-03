<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImmigrationConsultant extends Model
{
    protected $connection = 'cws';
    protected $table = 'immigration_consultants';

    protected $fillable = [
        'name',
        'email',
        'phone',
        'company',
        'city',
        'province',
        'country',
        'specialization',
        'notes',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}

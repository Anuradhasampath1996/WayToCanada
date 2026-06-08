<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExpressEntryDraw extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'draw_number',
        'draw_date',
        'draw_name',
        'minimum_crs_score',
        'invitations_issued',
        'round_type',
        'raw_data',
    ];

    protected function casts(): array
    {
        return [
            'draw_date' => 'date',
            'raw_data'  => 'array',
        ];
    }
}

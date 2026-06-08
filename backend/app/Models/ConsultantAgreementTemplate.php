<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantAgreementTemplate extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'consultant_id',
        'name',
        'pathway',
        'config',
        'is_default',
    ];

    protected function casts(): array
    {
        return [
            'config'     => 'array',
            'is_default' => 'boolean',
        ];
    }

    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consultant_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CrsRuleVersion extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'version',
        'effective_date',
        'rules',
        'source_url',
        'source_checksum',
        'is_active',
        'changelog',
        'last_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'effective_date'  => 'date',
            'rules'           => 'array',
            'is_active'       => 'boolean',
            'last_synced_at'  => 'datetime',
        ];
    }

    public static function active(): ?self
    {
        return static::where('is_active', true)->orderByDesc('effective_date')->first();
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaxRateVersion extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'version',
        'tax_year',
        'effective_date',
        'rates',
        'source_probes',
        'source_checksum',
        'is_active',
        'government_pages_changed',
        'changelog',
        'last_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'tax_year'                  => 'integer',
            'effective_date'            => 'date',
            'rates'                     => 'array',
            'source_probes'             => 'array',
            'is_active'                 => 'boolean',
            'government_pages_changed'  => 'boolean',
            'last_synced_at'            => 'datetime',
        ];
    }

    public static function active(): ?self
    {
        return static::where('is_active', true)->orderByDesc('effective_date')->first();
    }
}

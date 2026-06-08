<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LegislationCatalogEntry extends Model
{
    protected $table = 'legislation_catalog';

    protected $fillable = [
        'act_code', 'fr_act_code', 'title', 'category', 'is_active',
        'discovered_at', 'last_synced_at', 'documents_synced',
    ];

    protected $casts = [
        'is_active'        => 'boolean',
        'discovered_at'    => 'datetime',
        'last_synced_at'   => 'datetime',
        'documents_synced' => 'integer',
    ];
}

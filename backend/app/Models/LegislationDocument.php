<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LegislationDocument extends Model
{
    protected $fillable = [
        'slug', 'source_slug', 'act_code', 'title', 'language', 'format', 'category',
        'source_url', 'storage_path', 'content_hash', 'file_size', 'rendered_html',
        'provisions_count', 'ai_analyzed', 'last_synced_at', 'metadata', 'paired_document_id',
    ];

    protected $casts = [
        'metadata'        => 'array',
        'last_synced_at'  => 'datetime',
        'ai_analyzed'     => 'boolean',
        'file_size'       => 'integer',
        'provisions_count'=> 'integer',
    ];

    public function provisions(): HasMany
    {
        return $this->hasMany(LegislationProvision::class, 'document_id');
    }

    public function references(): HasMany
    {
        return $this->hasMany(LegislationReference::class, 'document_id');
    }

    public function pairedDocument(): BelongsTo
    {
        return $this->belongsTo(self::class, 'paired_document_id');
    }
}

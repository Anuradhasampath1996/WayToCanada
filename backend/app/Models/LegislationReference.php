<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LegislationReference extends Model
{
    protected $fillable = [
        'document_id', 'source_text', 'char_start', 'char_end',
        'target_act_code', 'target_provision_key', 'label',
        'source_type', 'is_external', 'custom_popup_html', 'admin_notes', 'is_active',
    ];

    protected $casts = [
        'is_external' => 'boolean',
        'is_active'   => 'boolean',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(LegislationDocument::class, 'document_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LegislationProvision extends Model
{
    protected $fillable = [
        'document_id', 'act_code', 'language', 'provision_key',
        'section_label', 'subsection_label', 'paragraph_label',
        'marginal_note', 'text_content', 'html_fragment', 'lims_fid',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(LegislationDocument::class, 'document_id');
    }
}

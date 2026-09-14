<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyCaseExhibit extends AcademyModel
{
    protected $table = 'academy_case_exhibits';

    protected $fillable = ['case_version_id', 'title', 'exhibit_type', 'body_html', 'file_url', 'sort_order'];

    public function caseVersion(): BelongsTo
    {
        return $this->belongsTo(AcademyCaseVersion::class, 'case_version_id');
    }
}

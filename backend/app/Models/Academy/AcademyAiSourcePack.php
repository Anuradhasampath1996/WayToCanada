<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademyAiSourcePack extends AcademyModel
{
    protected $table = 'academy_ai_source_packs';

    protected $fillable = ['generation_job_id', 'status'];

    public function job(): BelongsTo
    {
        return $this->belongsTo(AcademyAiGenerationJob::class, 'generation_job_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(AcademyAiSourcePackItem::class, 'source_pack_id');
    }
}

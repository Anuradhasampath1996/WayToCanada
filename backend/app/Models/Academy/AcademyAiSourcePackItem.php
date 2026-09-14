<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyAiSourcePackItem extends AcademyModel
{
    protected $table = 'academy_ai_source_pack_items';

    protected $fillable = [
        'source_pack_id', 'item_type', 'legal_source_id', 'legislation_document_id',
        'url', 'title', 'organization', 'storage_disk', 'storage_path',
        'admin_trusted_host', 'meta_json',
    ];

    protected function casts(): array
    {
        return [
            'admin_trusted_host' => 'boolean',
            'meta_json' => 'array',
        ];
    }

    public function pack(): BelongsTo
    {
        return $this->belongsTo(AcademyAiSourcePack::class, 'source_pack_id');
    }
}

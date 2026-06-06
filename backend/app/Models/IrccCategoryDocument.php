<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IrccCategoryDocument extends Model
{
    protected $fillable = [
        'ircc_category_id',
        'label',
        'doc_type',
        'file_path',
        'original_filename',
        'mime_type',
        'file_size',
        'sort_order',
        'is_active',
        'source_form_code',
        'source_url',
        'source_date_modified',
        'last_synced_at',
        'auto_synced',
    ];

    protected function casts(): array
    {
        return [
            'is_active'  => 'boolean',
            'auto_synced' => 'boolean',
            'last_synced_at' => 'datetime',
            'sort_order' => 'integer',
            'file_size'  => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(IrccCategory::class, 'ircc_category_id');
    }
}

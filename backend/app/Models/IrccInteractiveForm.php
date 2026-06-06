<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IrccInteractiveForm extends Model
{
    protected $fillable = [
        'ircc_category_id',
        'slug',
        'title',
        'description',
        'form_schema',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'form_schema' => 'array',
            'sort_order'  => 'integer',
            'is_active'   => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(IrccCategory::class, 'ircc_category_id');
    }

    public function responses(): HasMany
    {
        return $this->hasMany(IrccInteractiveFormResponse::class);
    }
}

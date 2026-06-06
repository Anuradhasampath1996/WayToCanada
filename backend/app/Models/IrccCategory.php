<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IrccCategory extends Model
{
    protected $fillable = ['parent_id', 'level', 'label', 'result', 'sort_order'];

    protected $casts = [
        'result' => 'array',
        'level'  => 'integer',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(IrccCategory::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(IrccCategory::class, 'parent_id')->orderBy('sort_order');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(IrccCategoryDocument::class)->orderBy('sort_order');
    }

    public function interactiveForms(): HasMany
    {
        return $this->hasMany(IrccInteractiveForm::class, 'ircc_category_id')->orderBy('sort_order');
    }

    /** Breadcrumb path labels from root to this node. */
    public function breadcrumb(): array
    {
        $parts = [$this->label];
        $node  = $this;

        while ($node->parent_id) {
            $node = $node->parent ?? IrccCategory::find($node->parent_id);
            if (! $node) {
                break;
            }
            array_unshift($parts, $node->label);
        }

        return $parts;
    }
}

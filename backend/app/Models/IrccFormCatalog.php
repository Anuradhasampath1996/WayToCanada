<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrccFormCatalog extends Model
{
    protected $table = 'ircc_form_catalog';

    protected $fillable = [
        'form_code',
        'normalized_code',
        'title',
        'page_url',
        'page_slug',
        'date_modified',
        'pdf_url',
        'pdf_filename',
        'last_fetched_at',
    ];

    protected function casts(): array
    {
        return [
            'last_fetched_at' => 'datetime',
        ];
    }
}

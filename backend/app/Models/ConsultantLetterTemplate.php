<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConsultantLetterTemplate extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'consultant_id',
        'name',
        'letter_type',
        'applies_to_client',
        'prompt_instructions',
        'subject_template',
        'body_html',
        'body_json',
        'is_default',
    ];

    protected function casts(): array
    {
        return [
            'applies_to_client' => 'boolean',
            'body_json'         => 'array',
            'is_default'        => 'boolean',
        ];
    }

    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consultant_id');
    }

    public function letters(): HasMany
    {
        return $this->hasMany(ConsultantLetter::class, 'template_id');
    }
}

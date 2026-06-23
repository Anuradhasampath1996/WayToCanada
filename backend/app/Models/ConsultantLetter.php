<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantLetter extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'consultant_id',
        'client_profile_id',
        'template_id',
        'title',
        'letter_type',
        'status',
        'subject',
        'body_html',
        'body_json',
        'generation_mode',
        'generation_prompt',
        'context_snapshot',
        'openai_used',
        'exported_pdf_path',
    ];

    protected function casts(): array
    {
        return [
            'body_json'         => 'array',
            'context_snapshot'  => 'array',
            'openai_used'       => 'boolean',
        ];
    }

    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consultant_id');
    }

    public function clientProfile(): BelongsTo
    {
        return $this->belongsTo(ClientProfile::class, 'client_profile_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(ConsultantLetterTemplate::class, 'template_id');
    }
}

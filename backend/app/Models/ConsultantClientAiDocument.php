<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantClientAiDocument extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'client_profile_id',
        'consultant_id',
        'original_filename',
        'mime_type',
        'storage_path',
        'disk',
        'extracted_text',
        'char_count',
        'page_count',
        'extraction_method',
        'status',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'char_count' => 'integer',
            'page_count' => 'integer',
        ];
    }

    public function clientProfile(): BelongsTo
    {
        return $this->belongsTo(ClientProfile::class);
    }

    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consultant_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentSubmission extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'case_file_id',
        'uploaded_by',
        'document_type',
        'document_label',
        'file_path',
        'original_filename',
        'mime_type',
        'file_size',
        'status',
        'ai_result',
        'ai_confidence',
        'ai_match_result',
        'rejection_comment',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'ai_result'       => 'array',
            'ai_match_result' => 'array',
            'ai_confidence'   => 'float',
            'reviewed_at'     => 'datetime',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────────────────

    public function caseFile(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    public function getFileUrlAttribute(): string
    {
        return asset('storage/' . $this->file_path);
    }
}

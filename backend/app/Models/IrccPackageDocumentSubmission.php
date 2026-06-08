<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IrccPackageDocumentSubmission extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'case_file_id',
        'ircc_category_document_id',
        'uploaded_by',
        'file_path',
        'original_filename',
        'mime_type',
        'file_size',
        'status',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'file_size'    => 'integer',
        ];
    }

    public function caseFile(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}

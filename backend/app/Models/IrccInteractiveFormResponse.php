<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IrccInteractiveFormResponse extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_SUBMITTED = 'submitted';

    protected $fillable = [
        'ircc_interactive_form_id',
        'case_file_id',
        'user_id',
        'response_data',
        'status',
        'submitted_at',
        'consultant_notes',
        'verified_fields',
        'reviewed_at',
        'reviewed_by',
    ];

    protected function casts(): array
    {
        return [
            'response_data' => 'array',
            'verified_fields' => 'array',
            'submitted_at'  => 'datetime',
            'reviewed_at'   => 'datetime',
        ];
    }

    public function form(): BelongsTo
    {
        return $this->belongsTo(IrccInteractiveForm::class, 'ircc_interactive_form_id');
    }

    public function caseFile(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function isSubmitted(): bool
    {
        return $this->status === self::STATUS_SUBMITTED;
    }
}

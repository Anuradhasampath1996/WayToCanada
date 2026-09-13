<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CaseGovernmentRequest extends Model
{
    protected $connection = 'cws';

    public const TYPES = [
        'aor' => 'Acknowledgement of Receipt (AOR)',
        'biometrics' => 'Biometrics',
        'medical' => 'Medical exam',
        'additional_documents' => 'Additional documents',
        'interview' => 'Interview',
        'pfl' => 'Procedural Fairness Letter (PFL)',
        'passport_request' => 'Passport request',
        'portal_invitation' => 'Portal invitation',
        'other' => 'Other',
    ];

    public const STATUSES = [
        'open',
        'client_notified',
        'response_in_progress',
        'answered',
    ];

    protected $fillable = [
        'case_file_id',
        'client_profile_id',
        'type',
        'custom_label',
        'status',
        'due_at',
        'notes',
        'client_notified_at',
        'answered_at',
        'answered_by',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'client_notified_at' => 'datetime',
            'answered_at' => 'datetime',
        ];
    }

    public function caseFile(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function label(): string
    {
        if ($this->type === 'other' && $this->custom_label) {
            return $this->custom_label;
        }

        return self::TYPES[$this->type] ?? $this->type;
    }
}

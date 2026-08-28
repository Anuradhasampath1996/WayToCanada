<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CaseFile extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'client_profile_id',
        'consultant_id',
        'case_number',
        'name',
        'status',
        'lifecycle_status',
        'lifecycle_note',
        'lifecycle_changed_at',
        'immigration_pathway',
        'pathway_assessment_notes',
        'pathway_assessment_crs_score',
        'pathway_assessment_ircc_crs_score',
        'pathway_assessment_snapshot',
        'pathway_assessment_rules_version',
        'pathway_assessment_at',
        'assigned_ircc_category_id',
        'application_package_assigned_at',
        'agreement_token',
        'agreement_sent_at',
        'agreement_last_reminder_at',
        'agreement_reminder_count',
        'agreement_signed_at',
        'application_forms_verified_at',
        'checklist_data',
        'agreement_fee',
        'agreement_notes',
        'agreement_config',
        'agreement_version',
        'agreement_milestone_payments',
        'client_signature',
        'agreement_signed_ip',
        'agreement_signed_user_agent',
        'signed_document_path',
    ];

    protected function casts(): array
    {
        return [
            'agreement_sent_at'               => 'datetime',
            'agreement_last_reminder_at'      => 'datetime',
            'agreement_signed_at'             => 'datetime',
            'application_forms_verified_at'   => 'datetime',
            'application_package_assigned_at' => 'datetime',
            'pathway_assessment_snapshot'     => 'array',
            'pathway_assessment_at'           => 'datetime',
            'lifecycle_changed_at'            => 'datetime',
            'checklist_data'                  => 'array',
            'agreement_fee'                   => 'decimal:2',
            'agreement_config'                => 'array',
            'agreement_milestone_payments'    => 'array',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────────────────

    public function clientProfile(): BelongsTo
    {
        return $this->belongsTo(ClientProfile::class);
    }

    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consultant_id');
    }

    public function assignedIrccCategory(): BelongsTo
    {
        return $this->belongsTo(IrccCategory::class, 'assigned_ircc_category_id');
    }

    public function documentSubmissions(): HasMany
    {
        return $this->hasMany(DocumentSubmission::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(CaseMessage::class);
    }

    public function interactiveFormResponses(): HasMany
    {
        return $this->hasMany(IrccInteractiveFormResponse::class);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /** Status order map for progress tracking. */
    public static function statusOrder(): array
    {
        return [
            'PENDING_ASSESSMENT'        => 0,
            'PATHWAY_SELECTED'          => 1,
            'AGREEMENT_SENT'            => 2,
            'AGREEMENT_SIGNED'          => 3,
            'DOCUMENTS_UPLOADING'       => 4,
            'UNDER_REVIEW'              => 5,
            'READY_FOR_SUBMISSION'      => 6,
            'APPLICATION_SUBMITTED'     => 7,
        ];
    }

    public function statusStep(): int
    {
        return static::statusOrder()[$this->status] ?? 0;
    }

    public function isAgreementSigned(): bool
    {
        return $this->agreement_signed_at !== null
            || $this->statusStep() >= static::statusOrder()['AGREEMENT_SIGNED'];
    }

    /** Repair status when agreement_signed_at exists but status was not advanced. */
    public function syncStatusFromAgreement(): bool
    {
        if (! $this->agreement_signed_at) {
            return false;
        }

        if ($this->statusStep() >= static::statusOrder()['AGREEMENT_SIGNED']) {
            return false;
        }

        $this->update(['status' => 'AGREEMENT_SIGNED']);

        return true;
    }

    /** Workflow step that reflects signed agreement even if status string is stale. */
    public function effectiveStatusStep(): int
    {
        if ($this->isAgreementSigned()) {
            return max($this->statusStep(), static::statusOrder()['AGREEMENT_SIGNED']);
        }

        if ($this->agreement_sent_at && $this->statusStep() < static::statusOrder()['AGREEMENT_SENT']) {
            return static::statusOrder()['AGREEMENT_SENT'];
        }

        return $this->statusStep();
    }
}

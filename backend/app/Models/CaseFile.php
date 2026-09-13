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
        'pathway_code',
        'pathway_assessment_notes',
        'pathway_assessment_crs_score',
        'pathway_assessment_ircc_crs_score',
        'pathway_assessment_snapshot',
        'pathway_assessment_rules_version',
        'pathway_assessment_at',
        'current_requirement_plan_id',
        'workflow_status',
        'confirmed_submission_portal',
        'consultation_completed_at',
        'consultation_skipped_at',
        'consultation_skip_reason',
        'profile_reviewed_at',
        'consultation_notes',
        'pathway_selection_reason',
        'pathway_alternatives',
        'pathway_risks',
        'maple_recommendation',
        'maple_recommended_at',
        'assigned_ircc_category_id',
        'application_package_assigned_at',
        'agreement_token',
        'agreement_sent_at',
        'agreement_last_reminder_at',
        'agreement_reminder_count',
        'agreement_signed_at',
        'application_forms_verified_at',
        'application_info_reviewed_at',
        'application_info_reviewed_by',
        'questionnaire_snapshot',
        'questionnaire_snapshot_hash',
        'questionnaire_snapshot_at',
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
        'representative_state',
        'representative_sent_at',
        'representative_signed_at',
        'representative_reviewed_at',
        'representative_completed_at',
        'case_activated_at',
        'final_review_checklist',
        'final_review_notes',
        'ready_for_client_review_at',
        'ready_for_client_review_by',
        'client_acknowledged_at',
        'client_acknowledgement_ip',
        'client_acknowledgement_user_agent',
        'client_declaration_signed_at',
        'client_declaration_signature',
        'ready_to_submit_at',
        'submitted_at',
        'submission_date',
        'application_number',
        'confirmation_number',
        'government_fees',
        'payment_confirmation',
        'receipt_path',
        'submitted_documents_snapshot',
        'decision_status',
        'decision_at',
        'decision_letter_path',
        'decision_note',
        'next_step_note',
        'closure_checklist',
        'closure_reviewed_at',
        'closure_reviewed_by',
    ];

    protected function casts(): array
    {
        return [
            'agreement_sent_at'               => 'datetime',
            'agreement_last_reminder_at'      => 'datetime',
            'agreement_signed_at'             => 'datetime',
            'application_forms_verified_at'   => 'datetime',
            'application_info_reviewed_at'  => 'datetime',
            'questionnaire_snapshot'        => 'array',
            'questionnaire_snapshot_at'     => 'datetime',
            'application_package_assigned_at' => 'datetime',
            'pathway_assessment_snapshot'     => 'array',
            'pathway_assessment_at'           => 'datetime',
            'consultation_completed_at'       => 'datetime',
            'consultation_skipped_at'         => 'datetime',
            'profile_reviewed_at'             => 'datetime',
            'maple_recommended_at'            => 'datetime',
            'representative_sent_at'          => 'datetime',
            'representative_signed_at'        => 'datetime',
            'representative_reviewed_at'      => 'datetime',
            'representative_completed_at'     => 'datetime',
            'case_activated_at'               => 'datetime',
            'final_review_checklist'          => 'array',
            'ready_for_client_review_at'      => 'datetime',
            'client_acknowledged_at'          => 'datetime',
            'client_declaration_signed_at'    => 'datetime',
            'ready_to_submit_at'              => 'datetime',
            'submitted_at'                    => 'datetime',
            'submission_date'                 => 'date',
            'government_fees'                 => 'decimal:2',
            'submitted_documents_snapshot'    => 'array',
            'decision_at'                     => 'datetime',
            'closure_checklist'               => 'array',
            'closure_reviewed_at'             => 'datetime',
            'pathway_alternatives'            => 'array',
            'pathway_risks'                   => 'array',
            'maple_recommendation'            => 'array',
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

    public function currentRequirementPlan(): BelongsTo
    {
        return $this->belongsTo(CaseRequirementPlan::class, 'current_requirement_plan_id');
    }

    public function requirementPlans(): HasMany
    {
        return $this->hasMany(CaseRequirementPlan::class);
    }

    public function historyEvents(): HasMany
    {
        return $this->hasMany(CaseHistoryEvent::class);
    }

    public function governmentRequests(): HasMany
    {
        return $this->hasMany(CaseGovernmentRequest::class);
    }

    public function resolvedWorkflowStatus(): string
    {
        return \App\Support\CaseWorkflowStatus::resolveForCase($this->workflow_status, $this->status);
    }

    public function workflowGroup(): string
    {
        return \App\Support\CaseWorkflowStatus::group($this->resolvedWorkflowStatus());
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

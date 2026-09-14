<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyExamEvidenceItem extends AcademyModel
{
    public const USAGE_REUSE_ALLOWED = 'official_public_reuse_allowed';
    public const USAGE_REFERENCE_ONLY = 'official_public_reference_only';
    public const USAGE_UNKNOWN = 'permission_unknown';
    public const USAGE_RESTRICTED = 'restricted';
    public const USAGE_PROHIBITED = 'prohibited';

    protected $table = 'academy_exam_evidence_items';

    protected $fillable = [
        'pack_id', 'source_type', 'authority', 'url', 'title', 'publication_date', 'effective_date',
        'version_label', 'retrieved_at', 'content_hash', 'is_official', 'verification_status',
        'usage_permission_status', 'robots_txt_allowed', 'snapshot_disk', 'snapshot_path',
        'full_file_stored', 'excerpt', 'pattern_metadata_json', 'disabled', 'classification_flag',
    ];

    protected function casts(): array
    {
        return [
            'publication_date' => 'date',
            'effective_date' => 'date',
            'retrieved_at' => 'datetime',
            'is_official' => 'boolean',
            'robots_txt_allowed' => 'boolean',
            'full_file_stored' => 'boolean',
            'disabled' => 'boolean',
            'pattern_metadata_json' => 'array',
        ];
    }

    public function pack(): BelongsTo
    {
        return $this->belongsTo(AcademyExamEvidencePack::class, 'pack_id');
    }

    public function mayStoreFullFile(): bool
    {
        return $this->usage_permission_status === self::USAGE_REUSE_ALLOWED
            && $this->verification_status === 'verified'
            && $this->classification_flag !== 'unverified_exam_material';
    }
}

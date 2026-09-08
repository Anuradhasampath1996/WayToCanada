<?php

namespace App\Models;

use App\Enums\GovernmentFormMappingStatus;
use App\Enums\GovernmentFormPdfTechnology;
use App\Enums\GovernmentFormSubmissionMode;
use App\Enums\GovernmentFormVersionStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GovernmentFormVersion extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'ircc_form_catalog_id',
        'form_code',
        'version_label',
        'name',
        'government_authority',
        'official_url',
        'template_storage_path',
        'template_sha256',
        'pdf_technology',
        'submission_mode',
        'engine_strategy',
        'mapping_version',
        'mapping_status',
        'status',
        'compatibility_status',
        'last_verified_at',
        'effective_date',
        'deprecated_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'pdf_technology'   => GovernmentFormPdfTechnology::class,
            'submission_mode'  => GovernmentFormSubmissionMode::class,
            'mapping_status'   => GovernmentFormMappingStatus::class,
            'status'           => GovernmentFormVersionStatus::class,
            'last_verified_at' => 'datetime',
            'effective_date'   => 'date',
            'deprecated_at'    => 'date',
        ];
    }

    public function mappings(): HasMany
    {
        return $this->hasMany(GovernmentFormMapping::class);
    }

    public function isGenerationAllowed(): bool
    {
        return $this->status === GovernmentFormVersionStatus::ACTIVE
            && $this->mapping_status === GovernmentFormMappingStatus::VERIFIED
            && $this->template_storage_path !== null
            && $this->template_sha256 !== null;
    }
}

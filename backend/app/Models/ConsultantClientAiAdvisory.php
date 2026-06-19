<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantClientAiAdvisory extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'client_profile_id',
        'consultant_id',
        'workflow_stage',
        'openai_used',
        'context_snapshot',
        'advisory_payload',
    ];

    protected function casts(): array
    {
        return [
            'openai_used'       => 'boolean',
            'context_snapshot'  => 'array',
            'advisory_payload'  => 'array',
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

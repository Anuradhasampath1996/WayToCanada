<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientActivityLog extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'client_profile_id',
        'case_file_id',
        'actor_user_id',
        'actor_type',
        'actor_name',
        'event_type',
        'title',
        'description',
        'metadata',
        'ip_address',
        'dedupe_key',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata'    => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function clientProfile(): BelongsTo
    {
        return $this->belongsTo(ClientProfile::class);
    }

    public function caseFile(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}

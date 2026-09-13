<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CaseHistoryEvent extends Model
{
    public const IMMUTABLE_TYPES = [
        'application_submitted',
        'client_acknowledged',
        'client_declaration_signed',
        'government_request_created',
        'government_request_answered',
        'decision_recorded',
        'case_closed',
    ];

    protected $connection = 'cws';

    protected static function booted(): void
    {
        static::updating(function (self $event) {
            if (in_array($event->getOriginal('event_type'), self::IMMUTABLE_TYPES, true)) {
                throw new \LogicException('Immutable case history events cannot be changed.');
            }
        });
    }

    protected $fillable = [
        'case_file_id',
        'client_profile_id',
        'actor_user_id',
        'event_type',
        'title',
        'description',
        'payload',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function caseFile(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function clientProfile(): BelongsTo
    {
        return $this->belongsTo(ClientProfile::class);
    }
}

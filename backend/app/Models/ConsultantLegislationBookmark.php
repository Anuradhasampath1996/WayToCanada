<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantLegislationBookmark extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'consultant_id',
        'client_profile_id',
        'act_code',
        'provision_key',
        'language',
        'label',
        'note',
    ];

    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consultant_id');
    }

    public function clientProfile(): BelongsTo
    {
        return $this->belongsTo(ClientProfile::class);
    }
}

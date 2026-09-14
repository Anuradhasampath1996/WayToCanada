<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantWorkspaceMemberPermission extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'member_id',
        'permissions',
    ];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(ConsultantWorkspaceMember::class, 'member_id');
    }
}

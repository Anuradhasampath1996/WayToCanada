<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantStorageFile extends Model
{
    protected $fillable = [
        'user_id',
        'folder_id',
        'disk_path',
        'original_filename',
        'mime_type',
        'size_bytes',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(ConsultantStorageFolder::class, 'folder_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantStorageAddon extends Model
{
    protected $fillable = [
        'user_id',
        'storage_addon_package_id',
        'status',
        'billing_cycle',
        'extra_bytes',
        'starts_at',
        'ends_at',
        'stripe_customer_id',
        'stripe_subscription_id',
        'stripe_checkout_session_id',
    ];

    protected $casts = [
        'extra_bytes' => 'integer',
        'starts_at'   => 'datetime',
        'ends_at'     => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(StorageAddonPackage::class, 'storage_addon_package_id');
    }

    public function isActive(): bool
    {
        if ($this->status !== 'active') {
            return false;
        }

        if ($this->ends_at && $this->ends_at->isPast()) {
            return false;
        }

        return true;
    }
}

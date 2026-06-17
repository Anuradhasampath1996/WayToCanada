<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StorageAddonPackage extends Model
{
    protected $fillable = [
        'name',
        'description',
        'extra_gb',
        'monthly_price',
        'yearly_price',
        'stripe_product_id',
        'stripe_monthly_price_id',
        'stripe_yearly_price_id',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'extra_gb'      => 'integer',
        'monthly_price' => 'float',
        'yearly_price'  => 'float',
        'is_active'     => 'boolean',
        'sort_order'    => 'integer',
    ];

    public function addons(): HasMany
    {
        return $this->hasMany(ConsultantStorageAddon::class);
    }

    public function extraBytes(): int
    {
        return (int) $this->extra_gb * 1024 * 1024 * 1024;
    }
}

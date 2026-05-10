<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPackage extends Model
{
    protected $fillable = [
        'name',
        'name_fr',
        'description',
        'description_fr',
        'monthly_price',
        'yearly_price',
        'free_trial_days',
        'features',
        'features_fr',
        'is_active',
        'sort_order',
        'paypal_product_id',
        'paypal_monthly_plan_id',
        'paypal_yearly_plan_id',
    ];

    protected $casts = [
        'features'         => 'array',
        'features_fr'      => 'array',
        'is_active'        => 'boolean',
        'monthly_price'    => 'float',
        'yearly_price'     => 'float',
        'free_trial_days'  => 'integer',
    ];
}

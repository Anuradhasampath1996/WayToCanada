<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MarketingService extends Model
{
    protected $connection = 'cws';

    public const BILLING_ONE_TIME = 'one_time';
    public const BILLING_MONTHLY   = 'monthly';

    protected $fillable = [
        'slug',
        'name',
        'tagline',
        'summary',
        'detail_body',
        'features',
        'price',
        'price_label',
        'billing_type',
        'stripe_product_id',
        'stripe_price_id',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'features'  => 'array',
            'price'     => 'decimal:2',
            'is_active' => 'boolean',
            'sort_order'=> 'integer',
        ];
    }

    public function orders(): HasMany
    {
        return $this->hasMany(ConsultantMarketingOrder::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantPaymentAccount extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'user_id',
        'stripe_connect_account_id',
        'stripe_charges_enabled',
        'stripe_details_submitted',
        'paypal_email',
        'paypal_me_username',
        'interac_email',
        'preferred_provider',
    ];

    protected $casts = [
        'stripe_charges_enabled'   => 'boolean',
        'stripe_details_submitted' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function hasStripe(): bool
    {
        return $this->stripe_connect_account_id
            && $this->stripe_charges_enabled;
    }

    public function hasPaypal(): bool
    {
        return (bool) ($this->paypal_email || $this->paypal_me_username);
    }

    public function hasInterac(): bool
    {
        return (bool) $this->interac_email;
    }

    public function isReadyFor(string $provider): bool
    {
        return match ($provider) {
            'stripe'  => $this->hasStripe(),
            'paypal'  => $this->hasPaypal(),
            'interac' => $this->hasInterac(),
            default   => false,
        };
    }
}

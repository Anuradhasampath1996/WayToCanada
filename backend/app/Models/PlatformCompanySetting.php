<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformCompanySetting extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'legal_name',
        'trade_name',
        'business_number',
        'gst_hst_number',
        'qst_number',
        'pst_number',
        'address_line1',
        'address_line2',
        'city',
        'province',
        'postal_code',
        'country',
        'phone',
        'billing_email',
        'support_email',
        'website',
        'invoice_footer',
        'invoice_prefix',
        'logo_url',
        'updated_by',
    ];

    public function updatedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}

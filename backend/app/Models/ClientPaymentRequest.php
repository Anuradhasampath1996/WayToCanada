<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ClientPaymentRequest extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'token',
        'case_file_id',
        'client_profile_id',
        'consultant_id',
        'title',
        'description',
        'amount',
        'currency',
        'provider',
        'payment_purpose',
        'status',
        'stripe_checkout_session_id',
        'paid_at',
        'sent_at',
        'cancelled_at',
    ];

    protected $casts = [
        'amount'       => 'decimal:2',
        'paid_at'      => 'datetime',
        'sent_at'      => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $request) {
            if (! $request->token) {
                $request->token = Str::random(48);
            }
        });
    }

    public function caseFile(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function clientProfile(): BelongsTo
    {
        return $this->belongsTo(ClientProfile::class);
    }

    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consultant_id');
    }

    public function publicUrl(): string
    {
        $base = rtrim(env('PUBLIC_DASHBOARD_URL', env('PUBLIC_FRONTEND_URL', 'http://localhost:3002')), '/');

        return $base . '/pay/' . $this->token;
    }

    public function isPayable(): bool
    {
        return $this->status === 'pending' || $this->status === 'awaiting_confirmation';
    }
}

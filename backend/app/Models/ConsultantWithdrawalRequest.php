<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class ConsultantWithdrawalRequest extends Model
{
    protected $connection = 'cws';

    public const STATUS_REQUESTED = 'requested';
    public const STATUS_UNDER_REVIEW = 'under_review';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_PAID = 'paid';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'user_id',
        'wallet_id',
        'amount',
        'currency',
        'status',
        'account_holder_name',
        'bank_name',
        'account_number_encrypted',
        'transit_number_encrypted',
        'institution_number',
        'routing_swift',
        'country',
        'account_last4',
        'consultant_note',
        'admin_notes',
        'payout_reference',
        'requested_at',
        'reviewed_at',
        'paid_at',
        'processed_by',
        'reserved_transaction_id',
        'paid_transaction_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'requested_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(ConsultantWallet::class, 'wallet_id');
    }

    public function maskedAccount(): string
    {
        return $this->account_last4 ? '•••• '.$this->account_last4 : '••••';
    }

    public function decryptAccountNumber(): string
    {
        return Crypt::decryptString($this->account_number_encrypted);
    }

    public function isCancellableByConsultant(): bool
    {
        return in_array($this->status, [self::STATUS_REQUESTED, self::STATUS_UNDER_REVIEW], true);
    }
}

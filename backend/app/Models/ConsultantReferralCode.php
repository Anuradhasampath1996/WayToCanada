<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConsultantReferralCode extends Model
{
    protected $connection = 'cws';

    protected $fillable = ['user_id', 'code', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function referrals(): HasMany
    {
        return $this->hasMany(ConsultantReferral::class, 'referral_code_id');
    }

    public function publicUrl(): string
    {
        return rtrim((string) config('referral.link_host'), '/').'/ref/'.$this->code;
    }
}

<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasApiTokens, HasRoles;

    // All users live in db_cws (the default connection)
    protected $connection = 'cws';

    // Spatie permission guard — must match the guard used when roles were seeded
    protected $guard_name = 'sanctum';

    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'google_id',
        'github_id',
        'avatar',
        'locale',
        'is_verified',
        'email_verified_at',
        'cicc_email',
        'rcic_number',
        'is_license_verified',
        'license_verified_at',
        'consultant_id',
        'company_name',
        'company_logo',
        'company_bio',
        'company_website',
        'company_phone',
        'company_address_line1',
        'company_address_line2',
        'company_city',
        'company_province',
        'company_postal_code',
        'company_country',
        'digital_signature',
        'rcic_community_last_seen_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'google_id',
        'github_id',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at'   => 'datetime',
            'password'            => 'hashed',
            'is_verified'         => 'boolean',
            'is_license_verified' => 'boolean',
            'license_verified_at' => 'datetime',
            'rcic_community_last_seen_at' => 'datetime',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────────────────

    /** All practice profiles (one per consultant). */
    public function clientProfiles(): HasMany
    {
        return $this->hasMany(ClientProfile::class);
    }

    /**
     * Preferred profile for portal APIs: match users.consultant_id when possible.
     * Kept as HasOne for eager-load compatibility (latest matching / latest overall).
     */
    public function clientProfile(): HasOne
    {
        return $this->hasOne(ClientProfile::class)->latestOfMany();
    }

    public function resolveClientProfile(): ?ClientProfile
    {
        if ($this->consultant_id) {
            $match = ClientProfile::query()
                ->where('user_id', $this->id)
                ->where('consultant_id', $this->consultant_id)
                ->first();
            if ($match) {
                return $match;
            }
        }

        return ClientProfile::query()
            ->where('user_id', $this->id)
            ->latest('id')
            ->first();
    }

    public function userNotifications(): HasMany
    {
        return $this->hasMany(UserNotification::class);
    }

    public function notificationPreferences(): HasOne
    {
        return $this->hasOne(UserNotificationPreference::class);
    }

    /** Clients created by this consultant. */
    public function clients(): HasMany
    {
        return $this->hasMany(ClientProfile::class, 'consultant_id');
    }

    public function consultantStorageAddons(): HasMany
    {
        return $this->hasMany(ConsultantStorageAddon::class);
    }

    /** True when the user can sign in with email + password. */
    public function hasPassword(): bool
    {
        return filled($this->password);
    }

    /** Linked sign-in methods for API / UI hints. */
    public function authProviders(): array
    {
        $providers = [];
        if ($this->hasPassword()) {
            $providers[] = 'password';
        }
        if (filled($this->google_id)) {
            $providers[] = 'google';
        }
        if (filled($this->github_id)) {
            $providers[] = 'github';
        }

        return $providers;
    }
}

<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
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
        'cicc_email',
        'rcic_number',
        'is_license_verified',
        'license_verified_at',
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
        ];
    }
}

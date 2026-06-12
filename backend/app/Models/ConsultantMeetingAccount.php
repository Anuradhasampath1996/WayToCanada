<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantMeetingAccount extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'user_id',
        'preferred_provider',
        'google_meet_url',
        'zoom_meeting_url',
        'teams_meeting_url',
        'google_account_email',
        'google_access_token',
        'google_refresh_token',
        'google_token_expires_at',
        'google_connected_at',
        'zoom_account_email',
        'zoom_access_token',
        'zoom_refresh_token',
        'zoom_token_expires_at',
        'zoom_connected_at',
        'teams_account_email',
        'teams_access_token',
        'teams_refresh_token',
        'teams_token_expires_at',
        'teams_connected_at',
    ];

    protected $casts = [
        'google_token_expires_at' => 'datetime',
        'google_connected_at'     => 'datetime',
        'zoom_token_expires_at'   => 'datetime',
        'zoom_connected_at'       => 'datetime',
        'teams_token_expires_at'  => 'datetime',
        'teams_connected_at'      => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function meetingUrlFor(string $provider): ?string
    {
        return match ($provider) {
            'google_meet' => $this->google_meet_url,
            'zoom'        => $this->zoom_meeting_url,
            'teams'       => $this->teams_meeting_url,
            default       => null,
        };
    }
}

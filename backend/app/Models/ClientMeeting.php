<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ClientMeeting extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'token',
        'case_file_id',
        'client_profile_id',
        'consultant_id',
        'title',
        'description',
        'scheduled_at',
        'duration_minutes',
        'timezone',
        'provider',
        'meeting_url',
        'external_meeting_id',
        'calendar_event_id',
        'status',
        'sent_at',
        'cancelled_at',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'sent_at'      => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $meeting) {
            if (! $meeting->token) {
                $meeting->token = Str::random(48);
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

        return $base . '/meet/' . $this->token;
    }

    public function googleCalendarUrl(): string
    {
        $start = $this->scheduled_at->utc();
        $end   = $start->copy()->addMinutes($this->duration_minutes);

        $params = http_build_query([
            'action'   => 'TEMPLATE',
            'text'     => $this->title,
            'dates'    => $start->format('Ymd\THis\Z') . '/' . $end->format('Ymd\THis\Z'),
            'details'  => trim(($this->description ?? '') . "\n\nJoin: " . $this->meeting_url),
            'location' => $this->meeting_url,
        ]);

        return 'https://calendar.google.com/calendar/render?' . $params;
    }
}

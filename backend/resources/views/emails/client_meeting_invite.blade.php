<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Meeting Invitation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #047857;">You're invited to an online meeting</h2>
    <p>Hi {{ $clientName }},</p>
    <p>
        <strong>{{ $companyName ?: $consultantName }}</strong> has scheduled a video consultation with you.
    </p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 4px; font-size: 14px; color: #64748b;">Meeting</p>
        <p style="margin: 0 0 12px; font-size: 20px; font-weight: bold;">{{ $title }}</p>
        <p style="margin: 0 0 6px;"><strong>When:</strong> {{ $when }}</p>
        <p style="margin: 0 0 6px;"><strong>Duration:</strong> {{ $duration }} minutes</p>
        <p style="margin: 0;"><strong>Platform:</strong> {{ $provider }}</p>
        @if($description)
            <p style="margin: 16px 0 0; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 12px;">{{ $description }}</p>
        @endif
    </div>
    <p>
        <a href="{{ $inviteUrl }}"
           style="display: inline-block; background: #059669; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-right: 8px;">
            View meeting details
        </a>
        <a href="{{ $meetingUrl }}"
           style="display: inline-block; background: #1e293b; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
            Join meeting
        </a>
    </p>
    <p style="font-size: 13px; color: #64748b;">
        Meeting link: <a href="{{ $meetingUrl }}">{{ $meetingUrl }}</a>
    </p>
    <p style="font-size: 13px; color: #94a3b8; margin-top: 32px;">Way To Canada — Immigration consultant workspace</p>
</body>
</html>

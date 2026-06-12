<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $notification->title }}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #047857; margin-top: 0;">{{ $notification->title }}</h2>
    <p style="white-space: pre-line;">{{ $notification->body }}</p>
    @if($notification->action_url)
        <p style="margin-top: 24px;">
            <a href="{{ $notification->action_url }}"
               style="display: inline-block; background: #047857; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
                View details
            </a>
        </p>
        <p style="font-size: 12px; color: #666; margin-top: 16px;">
            Or copy this link: {{ $notification->action_url }}
        </p>
    @endif
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;">
    <p style="font-size: 12px; color: #888;">WayToCanada — Immigration case management</p>
</body>
</html>

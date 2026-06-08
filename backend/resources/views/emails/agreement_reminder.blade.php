<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Retainer Agreement Reminder</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #1a365d;">Reminder: Retainer Agreement Pending Signature</h2>

    <p>Hi {{ $clientName }},</p>

    <p>
        This is a friendly reminder from <strong>{{ $consultantName }}</strong> that your retainer agreement
        @if($sentAt)
            (sent on {{ $sentAt }})
        @endif
        is still awaiting your signature.
    </p>

    <p style="margin: 28px 0;">
        <a href="{{ $agreementUrl }}"
           style="background: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Review &amp; Sign Agreement
        </a>
    </p>

    <p style="font-size: 13px; color: #666;">
        If you have questions, reply to this email or contact your consultant directly.
    </p>
</body>
</html>

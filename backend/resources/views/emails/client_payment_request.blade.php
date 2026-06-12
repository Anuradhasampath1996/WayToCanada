<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Payment Request</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #047857;">Payment request</h2>
    <p>Hi {{ $clientName }},</p>
    <p>
        <strong>{{ $companyName ?: $consultantName }}</strong> has sent you a payment request through Way To Canada.
    </p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #64748b;">Amount due</p>
        <p style="margin: 0 0 12px; font-size: 28px; font-weight: bold; color: #047857;">${{ $amount }} {{ $currency }}</p>
        <p style="margin: 0; font-weight: 600;">{{ $title }}</p>
        @if($description)
            <p style="margin: 12px 0 0; color: #475569;">{{ $description }}</p>
        @endif
    </div>
    <p>
        <a href="{{ $payUrl }}"
           style="display: inline-block; background: #059669; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
            Pay now
        </a>
    </p>
    <p style="font-size: 13px; color: #64748b;">
        Or copy this link: <a href="{{ $payUrl }}">{{ $payUrl }}</a>
    </p>
    <p style="font-size: 13px; color: #94a3b8; margin-top: 32px;">Way To Canada — Immigration consultant workspace</p>
</body>
</html>

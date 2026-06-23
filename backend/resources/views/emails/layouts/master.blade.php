<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $emailSubject ?? 'RCICMASTER' }}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
                <tr>
                    <td style="background:linear-gradient(135deg,#047857 0%,#059669 100%);padding:24px 28px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                                <td>
                                    <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
                                        {{ $brandName ?? 'RCICMASTER' }}
                                    </p>
                                    <p style="margin:6px 0 0;font-size:13px;color:#d1fae5;">
                                        {{ $brandTagline ?? 'Immigration consultant workspace' }}
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                @if(!empty($recipientName))
                <tr>
                    <td style="padding:20px 28px 0;font-size:14px;color:#64748b;">
                        Hi {{ $recipientName }},
                    </td>
                </tr>
                @endif
                <tr>
                    <td style="padding:20px 28px 28px;">
                        @yield('content')
                    </td>
                </tr>
                <tr>
                    <td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                        <p style="margin:0 0 8px;font-size:12px;color:#64748b;line-height:1.5;">
                            {{ $footerText ?? 'This is an automated message from RCICMASTER. Please do not reply directly to this email.' }}
                        </p>
                        @if(!empty($supportEmail))
                        <p style="margin:0;font-size:12px;color:#64748b;">
                            Support: <a href="mailto:{{ $supportEmail }}" style="color:#047857;">{{ $supportEmail }}</a>
                        </p>
                        @endif
                        @if(!empty($website))
                        <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">
                            <a href="{{ $website }}" style="color:#64748b;text-decoration:none;">{{ $website }}</a>
                        </p>
                        @endif
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <title>{{ $emailSubject ?? ($brandName ?? 'RCICMASTER') }}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:{{ $inkColor ?? '#000103' }};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:28px 12px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
                {{-- Red accent bar --}}
                <tr>
                    <td style="height:4px;line-height:4px;font-size:0;background:{{ $primaryColor ?? '#D01D20' }};">&nbsp;</td>
                </tr>
                {{-- Logo header --}}
                <tr>
                    <td style="padding:22px 28px 18px;background:#ffffff;border-bottom:1px solid #f4f4f5;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                                <td align="left" style="vertical-align:middle;">
                                    @if(!empty($logoUrl))
                                        <img src="{{ $logoUrl }}" alt="{{ $brandName ?? 'RCICMASTER' }}" width="180" style="display:block;max-width:180px;height:auto;border:0;">
                                    @else
                                        <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:{{ $inkColor ?? '#000103' }};">
                                            <span style="color:{{ $inkColor ?? '#000103' }};">RCIC</span><span style="color:{{ $primaryColor ?? '#D01D20' }};">MASTER</span>
                                        </p>
                                    @endif
                                    @if(!empty($brandTagline))
                                        <p style="margin:8px 0 0;font-size:12px;color:#71717a;letter-spacing:0.02em;">
                                            {{ $brandTagline }}
                                        </p>
                                    @endif
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                @if(!empty($recipientName))
                <tr>
                    <td style="padding:22px 28px 0;font-size:14px;color:#52525b;">
                        Hi {{ $recipientName }},
                    </td>
                </tr>
                @endif

                <tr>
                    <td style="padding:18px 28px 28px;">
                        @yield('content')
                    </td>
                </tr>

                <tr>
                    <td style="padding:20px 28px;background:#fafafa;border-top:1px solid #f4f4f5;">
                        <p style="margin:0 0 10px;font-size:12px;color:#71717a;line-height:1.55;">
                            {{ $footerText ?? 'This is an automated message from RCICMASTER. Please do not reply directly to this email.' }}
                        </p>
                        @if(!empty($supportEmail))
                        <p style="margin:0;font-size:12px;color:#71717a;">
                            Support:
                            <a href="mailto:{{ $supportEmail }}" style="color:{{ $primaryColor ?? '#D01D20' }};text-decoration:none;">{{ $supportEmail }}</a>
                        </p>
                        @endif
                        @if(!empty($website))
                        <p style="margin:8px 0 0;font-size:12px;">
                            <a href="{{ $website }}" style="color:#a1a1aa;text-decoration:none;">{{ $website }}</a>
                        </p>
                        @endif
                    </td>
                </tr>
            </table>
            <p style="margin:16px 0 0;font-size:11px;color:#a1a1aa;">
                &copy; {{ date('Y') }} {{ $brandName ?? 'RCICMASTER' }}. All rights reserved.
            </p>
        </td>
    </tr>
</table>
</body>
</html>

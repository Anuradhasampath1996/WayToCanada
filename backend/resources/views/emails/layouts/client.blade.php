@php
    $logoSrc = null;
    if (! empty($logoEmbedPath) && isset($message) && is_string($logoEmbedPath) && is_file($logoEmbedPath)) {
        try {
            $logoSrc = $message->embed($logoEmbedPath);
        } catch (\Throwable) {
            $logoSrc = null;
        }
    }
    if (! $logoSrc && ! empty($logoDataUri)) {
        $logoSrc = $logoDataUri;
    }
    if (! $logoSrc && ! empty($logoUrl)) {
        $logoSrc = $logoUrl;
    }
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <title>{{ $emailSubject ?? ($brandName ?? 'Message from your consultant') }}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:{{ $inkColor ?? '#000103' }};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:28px 12px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
                <tr>
                    <td style="padding:24px 28px 20px;background:#ffffff;border-bottom:1px solid #f4f4f5;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                                <td align="left" style="vertical-align:middle;">
                                    @if($logoSrc)
                                        <img src="{{ $logoSrc }}" alt="{{ $brandName }}" width="160" style="display:block;max-width:160px;width:160px;height:auto;border:0;margin-bottom:10px;outline:none;text-decoration:none;">
                                    @endif
                                    <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:{{ $inkColor ?? '#000103' }};">
                                        {{ $brandName }}
                                    </p>
                                    @if(!empty($brandTagline))
                                        <p style="margin:6px 0 0;font-size:12px;color:#71717a;">
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
                        <p style="margin:0 0 12px;font-size:12px;color:#71717a;line-height:1.55;">
                            {{ $footerText ?? 'This message was sent by your immigration consultant.' }}
                        </p>

                        @if(!empty($phone) || !empty($website) || !empty($supportEmail) || !empty($companyAddress))
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:12px;">
                            <tr>
                                <td style="font-size:12px;color:#52525b;line-height:1.6;">
                                    <strong style="color:{{ $inkColor ?? '#000103' }};">{{ $brandName }}</strong><br>
                                    @if(!empty($companyAddress))
                                        @foreach($companyAddress as $line)
                                            {{ $line }}<br>
                                        @endforeach
                                    @endif
                                    @if(!empty($phone))
                                        Tel: <a href="tel:{{ preg_replace('/\s+/', '', $phone) }}" style="color:#52525b;text-decoration:none;">{{ $phone }}</a><br>
                                    @endif
                                    @if(!empty($supportEmail))
                                        <a href="mailto:{{ $supportEmail }}" style="color:#52525b;text-decoration:none;">{{ $supportEmail }}</a><br>
                                    @endif
                                    @if(!empty($website))
                                        <a href="{{ $website }}" style="color:#52525b;text-decoration:none;">{{ $website }}</a>
                                    @endif
                                </td>
                            </tr>
                        </table>
                        @endif

                        @if(!empty($poweredBy))
                        <p style="margin:0;font-size:11px;color:#a1a1aa;">
                            @if(!empty($poweredByUrl))
                                <a href="{{ $poweredByUrl }}" style="color:#a1a1aa;text-decoration:none;">{{ $poweredBy }}</a>
                            @else
                                {{ $poweredBy }}
                            @endif
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

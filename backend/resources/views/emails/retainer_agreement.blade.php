@extends($mailLayout ?? 'emails.layouts.client')

@section('content')
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:{{ $inkColor ?? '#000103' }};line-height:1.3;">
        Retainer agreement ready to sign
    </h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3f3f46;">
        Your immigration consultant, <strong>{{ $consultantName }}</strong>, has prepared a retainer agreement for your case.
    </p>
    @if(!empty($pathway))
        <p style="margin:0 0 8px;font-size:13px;color:#71717a;">Assigned pathway</p>
        <p style="margin:0 0 18px;">
            <span style="display:inline-block;background:#f4f4f5;border:1px solid #e4e4e7;color:{{ $inkColor ?? '#000103' }};padding:5px 12px;border-radius:999px;font-size:13px;font-weight:600;">
                {{ $pathway }}
            </span>
        </p>
    @endif
    <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#3f3f46;">
        Please review and digitally sign the agreement to begin your case under RCIC professional standards.
    </p>
    @include('emails.partials.cta', [
        'href' => $agreementUrl,
        'label' => 'Review & Sign Agreement',
        'showFallback' => true,
        'primaryColor' => $primaryColor ?? '#000103',
    ])
    <div style="margin-top:22px;background:#fafafa;border-left:4px solid {{ $primaryColor ?? '#000103' }};padding:14px 16px;border-radius:0 8px 8px 0;">
        <p style="margin:0;font-size:13px;line-height:1.55;color:#52525b;">
            <strong>Important:</strong> This link is unique to you. Please do not share it.
        </p>
    </div>
@endsection

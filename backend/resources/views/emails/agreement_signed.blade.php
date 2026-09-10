@extends($mailLayout ?? 'emails.layouts.master')

@section('content')
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:{{ $inkColor ?? '#000103' }};line-height:1.3;">
        Client signed retainer agreement
    </h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3f3f46;">
        <strong>{{ $clientName }}</strong> has signed the retainer agreement
        @if(($signedVia ?? '') === 'uploaded_pdf')
            by uploading a signed PDF
        @else
            with a digital signature
        @endif.
    </p>
    @if(!empty($pathway))
        <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3f3f46;">
            Pathway: <strong>{{ $pathway }}</strong>
        </p>
    @endif
    <div style="margin:0 0 8px;background:#fef2f2;border-left:4px solid {{ $primaryColor ?? '#D01D20' }};padding:14px 16px;border-radius:0 8px 8px 0;">
        <p style="margin:0;font-size:13px;line-height:1.55;color:#7f1d1d;">
            Signed at: <strong>{{ $signedAt ?? 'Just now' }}</strong><br>
            Application forms are now unlocked for your client in their portal.
        </p>
    </div>
    @include('emails.partials.cta', [
        'href' => $workspaceUrl,
        'label' => 'Open client workspace',
        'showFallback' => true,
        'primaryColor' => $primaryColor ?? '#D01D20',
    ])
@endsection

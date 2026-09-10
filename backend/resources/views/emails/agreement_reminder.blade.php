@extends($mailLayout ?? 'emails.layouts.client')

@section('content')
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:{{ $inkColor ?? '#000103' }};line-height:1.3;">
        Reminder: retainer agreement pending
    </h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3f3f46;">
        This is a friendly reminder from <strong>{{ $consultantName }}</strong> that your retainer agreement
        @if(!empty($sentAt))
            (sent on {{ $sentAt }})
        @endif
        is still awaiting your signature.
    </p>
    @include('emails.partials.cta', [
        'href' => $agreementUrl,
        'label' => 'Review & Sign Agreement',
        'showFallback' => true,
        'primaryColor' => $primaryColor ?? '#000103',
    ])
    <p style="margin:18px 0 0;font-size:13px;color:#71717a;line-height:1.55;">
        If you have questions, contact your consultant directly.
    </p>
@endsection

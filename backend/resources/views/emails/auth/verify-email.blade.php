@extends($mailLayout ?? 'emails.layouts.master')

@section('content')
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:{{ $inkColor ?? '#000103' }};line-height:1.3;">
        Verify your email address
    </h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3f3f46;">
        Please click the button below to verify your email address for your {{ $brandName ?? 'RCICMASTER' }} account.
    </p>
    @include('emails.partials.cta', [
        'href' => $actionUrl,
        'label' => 'Verify Email Address',
        'showFallback' => true,
        'primaryColor' => $primaryColor ?? '#D01D20',
    ])
    <p style="margin:18px 0 0;font-size:13px;color:#71717a;line-height:1.55;">
        If you did not create an account, no further action is required.
    </p>
@endsection

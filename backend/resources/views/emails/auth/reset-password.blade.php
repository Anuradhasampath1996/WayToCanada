@extends($mailLayout ?? 'emails.layouts.master')

@section('content')
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:{{ $inkColor ?? '#000103' }};line-height:1.3;">
        Reset your password
    </h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3f3f46;">
        You are receiving this email because we received a password reset request for your {{ $brandName ?? 'RCICMASTER' }} account.
    </p>
    @include('emails.partials.cta', [
        'href' => $actionUrl,
        'label' => 'Reset Password',
        'showFallback' => true,
        'primaryColor' => $primaryColor ?? '#D01D20',
    ])
    <p style="margin:18px 0 0;font-size:13px;color:#71717a;line-height:1.55;">
        This password reset link will expire in {{ $expireMinutes ?? 60 }} minutes. If you did not request a password reset, no further action is required.
    </p>
@endsection

@extends($mailLayout ?? 'emails.layouts.client')

@section('content')
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:{{ $inkColor ?? '#000103' }};line-height:1.3;">
        Payment request
    </h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3f3f46;">
        <strong>{{ $companyName ?: $consultantName }}</strong> has sent you a payment request.
    </p>
    <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:20px;margin:8px 0 8px;">
        <p style="margin:0 0 6px;font-size:13px;color:#71717a;">Amount due</p>
        <p style="margin:0 0 12px;font-size:28px;font-weight:700;color:{{ $inkColor ?? '#000103' }};">${{ $amount }} {{ $currency }}</p>
        <p style="margin:0;font-weight:600;font-size:15px;color:{{ $inkColor ?? '#000103' }};">{{ $title }}</p>
        @if(!empty($description))
            <p style="margin:12px 0 0;color:#52525b;font-size:14px;line-height:1.55;">{{ $description }}</p>
        @endif
    </div>
    @include('emails.partials.cta', [
        'href' => $payUrl,
        'label' => 'Pay now',
        'showFallback' => true,
        'primaryColor' => $primaryColor ?? '#000103',
    ])
@endsection

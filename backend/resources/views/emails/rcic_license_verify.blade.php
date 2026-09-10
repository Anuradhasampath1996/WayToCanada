@extends($mailLayout ?? 'emails.layouts.master')

@section('content')
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:{{ $inkColor ?? '#000103' }};line-height:1.3;">
        RCIC licence verification request
    </h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3f3f46;">
        A consultant has registered on <strong>{{ $brandName ?? 'RCICMASTER' }}</strong> and claimed the following RCIC registration number.
        If you authorised this account, please verify their licence.
    </p>

    <div style="background:#fef2f2;border-left:4px solid {{ $primaryColor ?? '#D01D20' }};border-radius:0 8px 8px 0;padding:16px 18px;margin:8px 0 16px;">
        <p style="margin:0 0 6px;font-size:14px;color:#3f3f46;"><strong>Applicant name:</strong> {{ $applicant->name }}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#3f3f46;"><strong>Applicant email:</strong> {{ $applicant->email }}</p>
        <p style="margin:0;font-size:14px;color:#3f3f46;"><strong>RCIC number:</strong> {{ $rcicNumber }}</p>
    </div>

    @include('emails.partials.cta', [
        'href' => $verificationUrl,
        'label' => 'Verify licence',
        'showFallback' => true,
        'primaryColor' => $primaryColor ?? '#D01D20',
    ])
@endsection

@extends($mailLayout ?? 'emails.layouts.client')

@section('content')
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:{{ $inkColor ?? '#000103' }};line-height:1.3;">
        You've been added to a practice
    </h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3f3f46;">
        <strong>{{ $companyName ?: $consultantName }}</strong> has added you to their practice workspace.
    </p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#3f3f46;">
        Sign in with your existing account to continue. If you work with more than one consultant, each practice keeps its own case files.
    </p>
    @include('emails.partials.cta', [
        'href' => $loginUrl,
        'label' => 'Sign in',
        'showFallback' => true,
        'primaryColor' => $primaryColor ?? '#000103',
    ])
@endsection

@extends($mailLayout ?? 'emails.layouts.client')

@section('content')
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:{{ $inkColor ?? '#000103' }};line-height:1.3;">
        Meeting invitation
    </h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3f3f46;">
        <strong>{{ $companyName ?: $consultantName }}</strong> has scheduled a video consultation with you.
    </p>
    <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:20px;margin:8px 0 8px;">
        <p style="margin:0 0 4px;font-size:13px;color:#71717a;">Meeting</p>
        <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:{{ $inkColor ?? '#000103' }};">{{ $title }}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#3f3f46;"><strong>When:</strong> {{ $when }}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#3f3f46;"><strong>Duration:</strong> {{ $duration }} minutes</p>
        <p style="margin:0;font-size:14px;color:#3f3f46;"><strong>Platform:</strong> {{ $provider }}</p>
        @if(!empty($description))
            <p style="margin:14px 0 0;padding-top:12px;border-top:1px solid #e4e4e7;color:#52525b;font-size:14px;line-height:1.55;">{{ $description }}</p>
        @endif
    </div>
    @include('emails.partials.cta', [
        'href' => $inviteUrl,
        'label' => 'View meeting details',
        'showFallback' => false,
        'primaryColor' => $primaryColor ?? '#000103',
    ])
    @if(!empty($meetingUrl))
        @include('emails.partials.cta', [
            'href' => $meetingUrl,
            'label' => 'Join meeting',
            'showFallback' => true,
            'primaryColor' => '#3f3f46',
        ])
    @endif
@endsection

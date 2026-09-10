@extends($mailLayout ?? 'emails.layouts.master')

@section('content')
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:{{ $inkColor ?? '#000103' }};line-height:1.3;">
        {{ $notification->title }}
    </h1>
    @if(!empty($categoryLabel))
        <p style="margin:0 0 16px;">
            <span style="display:inline-block;background:#fef2f2;color:{{ $primaryColor ?? '#D01D20' }};font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:0.04em;">
                {{ $categoryLabel }}
            </span>
        </p>
    @endif
    <p style="margin:0;font-size:15px;line-height:1.65;color:#3f3f46;white-space:pre-line;">{{ $notification->body }}</p>
    @include('emails.partials.cta', [
        'href' => $notification->action_url,
        'label' => $actionLabel ?? 'View details',
        'showFallback' => true,
        'primaryColor' => $primaryColor ?? '#D01D20',
    ])
@endsection

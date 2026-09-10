@extends($mailLayout ?? 'emails.layouts.client')

@section('content')
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:{{ $inkColor ?? '#000103' }};line-height:1.3;">
        You've been invited
    </h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3f3f46;">
        <strong>{{ $consultant->company_name ?: $consultant->name }}</strong> has created a client portal account for you
        so you can track your immigration case, share documents, and stay updated.
    </p>

    <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:20px;margin:8px 0 16px;">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;">Your login email</p>
        <p style="margin:0 0 14px;font-size:16px;font-weight:600;font-family:Consolas,Monaco,monospace;color:{{ $inkColor ?? '#000103' }};">{{ $client->email }}</p>
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;">Temporary password</p>
        <p style="margin:0;font-size:16px;font-weight:600;font-family:Consolas,Monaco,monospace;color:{{ $inkColor ?? '#000103' }};">{{ $password }}</p>
    </div>

    <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#3f3f46;">
        Please sign in and change your password as soon as possible.
    </p>

    @include('emails.partials.cta', [
        'href' => $loginUrl,
        'label' => 'Sign in to your portal',
        'showFallback' => true,
        'primaryColor' => $primaryColor ?? '#000103',
    ])
@endsection

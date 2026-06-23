@extends('emails.layouts.master')

@section('content')
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3;">
        {{ $notification->title }}
    </h1>
    @if(!empty($categoryLabel))
        <p style="margin:0 0 16px;">
            <span style="display:inline-block;background:#ecfdf5;color:#047857;font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:0.04em;">
                {{ $categoryLabel }}
            </span>
        </p>
    @endif
    <p style="margin:0;font-size:15px;line-height:1.65;color:#334155;white-space:pre-line;">{{ $notification->body }}</p>
    @if($notification->action_url)
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px;">
            <tr>
                <td style="border-radius:10px;background:#059669;">
                    <a href="{{ $notification->action_url }}"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                        {{ $actionLabel ?? 'View details' }}
                    </a>
                </td>
            </tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">
            Or copy this link: {{ $notification->action_url }}
        </p>
    @endif
@endsection

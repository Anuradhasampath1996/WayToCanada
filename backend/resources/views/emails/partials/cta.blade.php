@php
    $btnBg = $primaryColor ?? '#D01D20';
@endphp
@if(!empty($href))
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;">
    <tr>
        <td style="border-radius:10px;background:{{ $btnBg }};">
            <a href="{{ $href }}"
               style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                {{ $label ?? 'Continue' }}
            </a>
        </td>
    </tr>
</table>
@if(!empty($showFallback))
<p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;word-break:break-all;line-height:1.5;">
    Or copy this link: {{ $href }}
</p>
@endif
@endif

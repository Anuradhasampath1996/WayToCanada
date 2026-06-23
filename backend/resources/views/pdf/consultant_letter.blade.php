<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    <style>
        @page { margin: 48px 54px 56px 54px; }
        body {
            font-family: DejaVu Serif, Times, serif;
            font-size: 11pt;
            line-height: 1.65;
            color: #111827;
            margin: 0;
        }
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
        .header-table td { vertical-align: top; }
        .header-logo { width: 32%; vertical-align: middle; }
        .header-details { width: 68%; text-align: right; font-size: 10pt; color: #374151; line-height: 1.55; vertical-align: middle; }
        .logo { height: 88px; width: auto; max-width: 200px; display: block; object-fit: contain; }
        .company-name { font-size: 13pt; font-weight: bold; color: #111827; margin: 0 0 4px; }
        .consultant-name { font-weight: bold; margin: 0 0 3px; }
        .meta-line { margin: 0 0 2px; }
        .doc-date { text-align: right; font-size: 11pt; color: #374151; margin: 0 0 28px; }
        .re-line, .subject-line { font-size: 11pt; margin: 0 0 6px; }
        .subject-line { margin-bottom: 22px; }
        .label { font-weight: bold; }
        .body p { margin: 0 0 12px; }
        .body ul, .body ol { margin: 0 0 12px 20px; padding: 0; }
        .body li { margin-bottom: 4px; }
        .signature-block { margin-top: 36px; font-size: 10.5pt; color: #374151; line-height: 1.55; }
        .sig-image { height: 72px; width: auto; max-width: 220px; display: block; object-fit: contain; margin-bottom: 10px; }
        .sig-name { font-weight: bold; font-size: 11pt; color: #111827; margin: 0 0 3px; }
        .sig-line { margin: 0 0 2px; }
        .page-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            font-size: 7.5pt;
            color: #9ca3af;
            text-align: center;
        }
    </style>
</head>
<body>
    <table class="header-table">
        <tr>
            <td class="header-logo">
                @if($companyLogo)
                    <img src="{{ $companyLogo }}" alt="Logo" class="logo">
                @endif
            </td>
            <td class="header-details">
                @if($companyName)
                    <div class="company-name">{{ $companyName }}</div>
                @endif
                @if($consultantName && $consultantName !== $companyName)
                    <div class="consultant-name">{{ $consultantName }}</div>
                @endif
                @if($companyAddress)
                    <div class="meta-line">{{ $companyAddress }}</div>
                @endif
                @if($companyPhone)
                    <div class="meta-line">Tel: {{ $companyPhone }}</div>
                @endif
                @if($consultantEmail)
                    <div class="meta-line">{{ $consultantEmail }}</div>
                @endif
                @if($companyWebsite)
                    <div class="meta-line">{{ $companyWebsite }}</div>
                @endif
                @if($rcicNumber)
                    <div class="meta-line">RCIC License No. {{ $rcicNumber }}</div>
                @endif
            </td>
        </tr>
    </table>

    <div class="doc-date">{{ $letterDate }}</div>

    @if($clientName)
        <div class="re-line">
            <span class="label">Re:</span>
            {{ $clientName }}@if($clientPathway) — {{ $clientPathway }} Application @endif
        </div>
    @endif

    @if($subject)
        <div class="subject-line"><span class="label">Subject:</span> {{ $subject }}</div>
    @endif

    <div class="body">
        {!! $bodyHtml !!}
    </div>

    <div class="signature-block">
        @if($digitalSignature)
            <img src="{{ $digitalSignature }}" alt="Signature" class="sig-image">
        @endif
        <div class="sig-name">{{ $consultantName }}</div>
        @if($rcicNumber)
            <div class="sig-line">Regulated Canadian Immigration Consultant (RCIC)</div>
            <div class="sig-line">License No. {{ $rcicNumber }}</div>
        @endif
        @if($companyName)
            <div class="sig-line">{{ $companyName }}</div>
        @endif
        @if($companyPhone || $consultantEmail)
            <div class="sig-line">
                @if($companyPhone){{ $companyPhone }}@endif
                @if($companyPhone && $consultantEmail) · @endif
                @if($consultantEmail){{ $consultantEmail }}@endif
            </div>
        @endif
    </div>

    <div class="page-footer">
        Confidential — prepared by {{ $companyName ?: $consultantName }}
        @if($rcicNumber)
            · RCIC {{ $rcicNumber }}
        @endif
        · {{ $generatedDate }}
    </div>
</body>
</html>

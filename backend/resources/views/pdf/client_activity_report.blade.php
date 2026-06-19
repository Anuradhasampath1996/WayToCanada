<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Client Activity Report — {{ $clientUser?->name ?? 'Client' }}</title>
    <style>
        @page { margin: 28px 32px 40px 32px; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 9.5px;
            line-height: 1.45;
            color: #111827;
            margin: 0;
        }
        .muted { color: #6b7280; }
        .header {
            border-bottom: 2px solid #1e3a5f;
            padding-bottom: 14px;
            margin-bottom: 16px;
        }
        .header-row { width: 100%; }
        .header-left { width: 58%; vertical-align: top; display: inline-block; }
        .header-right { width: 40%; vertical-align: top; display: inline-block; text-align: right; }
        .logo { max-height: 52px; max-width: 140px; margin-bottom: 6px; }
        .company-name { font-size: 14px; font-weight: bold; color: #1e3a5f; margin: 0 0 4px; }
        .doc-title {
            font-size: 15px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #1e3a5f;
            margin: 0 0 4px;
        }
        .doc-subtitle { font-size: 10px; color: #374151; margin: 0; }
        .meta-box {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            padding: 8px 10px;
            margin-bottom: 14px;
            font-size: 9px;
        }
        .meta-row { margin-bottom: 3px; }
        .meta-label { font-weight: bold; color: #374151; }
        .parties {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
        }
        .parties th {
            background: #1e3a5f;
            color: #fff;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            padding: 7px 10px;
            text-align: left;
        }
        .parties td {
            border: 1px solid #d1d5db;
            padding: 8px 10px;
            vertical-align: top;
            width: 50%;
        }
        .party-name { font-weight: bold; font-size: 10px; margin-bottom: 4px; }
        .summary {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
        }
        .summary td {
            border: 1px solid #d1d5db;
            padding: 6px 10px;
            text-align: center;
            width: 25%;
        }
        .summary .num { font-size: 14px; font-weight: bold; color: #1e3a5f; }
        .summary .lbl { font-size: 8px; text-transform: uppercase; color: #6b7280; }
        .section-title {
            font-size: 9px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #1e3a5f;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 4px;
            margin: 0 0 8px;
        }
        .log-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5px;
        }
        .log-table th {
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            padding: 5px 6px;
            text-align: left;
            font-size: 8px;
            text-transform: uppercase;
        }
        .log-table td {
            border: 1px solid #e5e7eb;
            padding: 5px 6px;
            vertical-align: top;
        }
        .log-table tr:nth-child(even) td { background: #fafafa; }
        .actor-client { color: #0369a1; font-weight: bold; }
        .actor-consultant { color: #6d28d9; font-weight: bold; }
        .actor-system { color: #6b7280; }
        .footer-note {
            margin-top: 16px;
            padding: 10px 12px;
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            font-size: 8.5px;
            color: #14532d;
        }
        .certification {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid #d1d5db;
            font-size: 8.5px;
            color: #374151;
        }
        .empty { text-align: center; padding: 24px; color: #6b7280; font-style: italic; }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-row">
            <div class="header-left">
                @if($companyLogo)
                    <img src="{{ $companyLogo }}" alt="Logo" class="logo"><br>
                @endif
                <div class="company-name">{{ $companyName }}</div>
                @if($companyAddress)
                    <div class="muted">{{ $companyAddress }}</div>
                @endif
                @if($companyPhone)
                    <div class="muted">{{ $companyPhone }}</div>
                @endif
                @if($consultant->email)
                    <div class="muted">{{ $consultant->email }}</div>
                @endif
                @if($companyWeb)
                    <div class="muted">{{ $companyWeb }}</div>
                @endif
                @if($rcicNo)
                    <div class="muted"><strong>RCIC License No.</strong> {{ $rcicNo }}</div>
                @endif
            </div>
            <div class="header-right">
                <div class="doc-title">Client Activity &amp;<br>Compliance Report</div>
                <p class="doc-subtitle">Portal audit record</p>
                <p class="muted" style="margin-top:8px; font-size:8px;">
                    Report ref: <strong>{{ $reportRef }}</strong><br>
                    Generated: {{ $generatedAt }}
                </p>
            </div>
        </div>
    </div>

    <div class="meta-box">
        <div class="meta-row"><span class="meta-label">Document purpose:</span> Official record of client–consultant interactions on the RCICMASTER secure portal, suitable for compliance review, dispute resolution, and professional conduct documentation.</div>
        <div class="meta-row"><span class="meta-label">Report scope:</span> {{ implode(' · ', $filterLabels) }}</div>
    </div>

    <table class="parties">
        <thead>
            <tr>
                <th>Regulated Immigration Consultant</th>
                <th>Client</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>
                    <div class="party-name">{{ $consultant->name }}</div>
                    @if($rcicNo)
                        <div>RCIC License No. {{ $rcicNo }}</div>
                    @endif
                    @if($companyName && $companyName !== $consultant->name)
                        <div>{{ $companyName }}</div>
                    @endif
                    @if($consultant->email)
                        <div class="muted">{{ $consultant->email }}</div>
                    @endif
                    @if($companyPhone)
                        <div class="muted">{{ $companyPhone }}</div>
                    @endif
                </td>
                <td>
                    <div class="party-name">{{ $clientUser?->name ?? '—' }}</div>
                    @if($clientUser?->email)
                        <div>{{ $clientUser->email }}</div>
                    @endif
                    @if($clientPhone)
                        <div class="muted">{{ $clientPhone }}</div>
                    @endif
                    @if($client->passport_number)
                        <div class="muted">Passport: {{ $client->passport_number }}</div>
                    @endif
                    @if($pathway)
                        <div class="muted">Pathway: {{ $pathway }}</div>
                    @endif
                    @if($client->invited_at)
                        <div class="muted">Invited: {{ $client->invited_at->timezone('America/Toronto')->format('M j, Y') }}</div>
                    @endif
                    @if($clientUser?->created_at)
                        <div class="muted">Registered: {{ $clientUser->created_at->timezone('America/Toronto')->format('M j, Y') }}</div>
                    @endif
                </td>
            </tr>
        </tbody>
    </table>

    <table class="summary">
        <tr>
            <td>
                <div class="num">{{ $totalEvents }}</div>
                <div class="lbl">Total events</div>
            </td>
            <td>
                <div class="num">{{ $clientActions }}</div>
                <div class="lbl">Client actions</div>
            </td>
            <td>
                <div class="num">{{ $consultantActions }}</div>
                <div class="lbl">Consultant actions</div>
            </td>
            <td>
                <div class="num">{{ $logs->first()?->occurred_at?->timezone('America/Toronto')->format('M j, Y') ?? '—' }}</div>
                <div class="lbl">First recorded event</div>
            </td>
        </tr>
    </table>

    <div class="section-title">Chronological activity log</div>

    @if($logs->isEmpty())
        <div class="empty">No activity events match the selected criteria.</div>
    @else
        <table class="log-table">
            <thead>
                <tr>
                    <th style="width:4%">#</th>
                    <th style="width:14%">Date &amp; time</th>
                    <th style="width:14%">Actor</th>
                    <th style="width:22%">Event</th>
                    <th style="width:36%">Description</th>
                    <th style="width:10%">IP</th>
                </tr>
            </thead>
            <tbody>
                @foreach($logs as $i => $log)
                    <tr>
                        <td>{{ $i + 1 }}</td>
                        <td>{{ $log->occurred_at->timezone('America/Toronto')->format('Y-m-d H:i') }} ET</td>
                        <td>
                            <span class="actor-{{ $log->actor_type }}">{{ ucfirst($log->actor_type) }}</span>
                            @if($log->actor_name)
                                <br><span class="muted">{{ $log->actor_name }}</span>
                            @endif
                        </td>
                        <td><strong>{{ $log->title }}</strong></td>
                        <td>{{ $log->description ?? '—' }}</td>
                        <td class="muted">{{ $log->ip_address ?? '—' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    <div class="footer-note">
        <strong>CICC Code of Professional Conduct — record-keeping reference</strong><br>
        This report documents portal interactions between the consultant and client as recorded by the RCICMASTER
        system. It supports transparency, accountability, and professional conduct obligations under the College of
        Immigration and Citizenship Consultants (CICC). Reference:
        college-ic.ca/protecting-the-public/code-of-professional-conduct
    </div>

    <div class="certification">
        <strong>Certification statement:</strong> This document was electronically generated from immutable audit logs
        maintained on the RCICMASTER platform (Report {{ $reportRef }}). Each entry reflects the date, time, actor,
        and action as recorded at the time of the event. This report is intended for professional, compliance, and
        dispute-resolution purposes.
    </div>

    <script type="text/php">
        if (isset($pdf)) {
            $pdf->page_text(32, 820, "RCICMASTER Client Activity Report · {{ $reportRef }}", null, 7, [0.4, 0.4, 0.4]);
            $pdf->page_text(480, 820, "Page {PAGE_NUM} of {PAGE_COUNT}", null, 7, [0.4, 0.4, 0.4]);
        }
    </script>
</body>
</html>

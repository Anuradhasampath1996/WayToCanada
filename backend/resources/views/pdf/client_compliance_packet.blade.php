<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Compliance Packet — {{ $clientUser?->name ?? 'Client' }}</title>
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
            font-size: 14px;
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
        .section-title {
            font-size: 9px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #1e3a5f;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 4px;
            margin: 16px 0 8px;
        }
        .section-title:first-of-type { margin-top: 0; }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5px;
            margin-bottom: 10px;
        }
        .data-table th {
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            padding: 5px 6px;
            text-align: left;
            font-size: 8px;
            text-transform: uppercase;
        }
        .data-table td {
            border: 1px solid #e5e7eb;
            padding: 5px 6px;
            vertical-align: top;
        }
        .data-table tr:nth-child(even) td { background: #fafafa; }
        .kv-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9px; }
        .kv-table td { border: 1px solid #e5e7eb; padding: 5px 8px; vertical-align: top; }
        .kv-table td:first-child { width: 32%; font-weight: bold; background: #f9fafb; color: #374151; }
        .summary-row {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }
        .summary-row td {
            border: 1px solid #d1d5db;
            padding: 6px 10px;
            text-align: center;
            width: 25%;
        }
        .summary-row .num { font-size: 13px; font-weight: bold; color: #1e3a5f; }
        .summary-row .lbl { font-size: 8px; text-transform: uppercase; color: #6b7280; }
        .actor-client { color: #0369a1; font-weight: bold; }
        .actor-consultant { color: #6d28d9; font-weight: bold; }
        .actor-system { color: #6b7280; }
        .status-signed { color: #15803d; font-weight: bold; }
        .status-pending { color: #b45309; font-weight: bold; }
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
        .empty { text-align: center; padding: 16px; color: #6b7280; font-style: italic; font-size: 9px; }
        .truncate-note { font-size: 8px; color: #b45309; margin-bottom: 6px; }
        .page-break { page-break-before: always; }
        .text-block { font-size: 9px; margin-bottom: 8px; white-space: pre-wrap; }
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
                @if($rcicNo)
                    <div class="muted"><strong>RCIC License No.</strong> {{ $rcicNo }}</div>
                @endif
            </div>
            <div class="header-right">
                <div class="doc-title">Client Compliance<br>Packet</div>
                <p class="doc-subtitle">CICC audit &amp; record-keeping bundle</p>
                <p class="muted" style="margin-top:8px; font-size:8px;">
                    Report ref: <strong>{{ $reportRef }}</strong><br>
                    Generated: {{ $generatedAt }}
                </p>
            </div>
        </div>
    </div>

    <div class="meta-box">
        <div class="meta-row">
            <span class="meta-label">Document purpose:</span>
            Consolidated compliance export combining retainer agreement summary, client trust account ledger,
            document inventory, and portal activity audit log — suitable for CICC review, dispute resolution,
            and professional conduct documentation.
        </div>
        <div class="meta-row">
            <span class="meta-label">Packet contents:</span>
            Case overview · Retainer agreement · Trust ledger · Document inventory · Activity log
        </div>
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
                    @if($consultant->email)
                        <div class="muted">{{ $consultant->email }}</div>
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
                    @if($pathway)
                        <div class="muted">Pathway: {{ $pathway }}</div>
                    @endif
                </td>
            </tr>
        </tbody>
    </table>

  {{-- Section 1: Case overview --}}
    <div class="section-title">1. Case overview</div>
    @if($caseFile)
        <table class="kv-table">
            <tr><td>Case status</td><td>{{ str_replace('_', ' ', $caseFile->status) }}</td></tr>
            <tr><td>Immigration pathway</td><td>{{ $pathway ?? '—' }}</td></tr>
            @if($caseFile->pathway_assessment_crs_score)
                <tr><td>CRS score (assessment)</td><td>{{ $caseFile->pathway_assessment_crs_score }}</td></tr>
            @endif
            @if($caseFile->pathway_assessment_at)
                <tr><td>Pathway assessed</td><td>{{ $caseFile->pathway_assessment_at->timezone('America/Toronto')->format('M j, Y g:i A T') }}</td></tr>
            @endif
            @if($caseFile->application_forms_verified_at)
                <tr><td>Forms verified</td><td>{{ $caseFile->application_forms_verified_at->timezone('America/Toronto')->format('M j, Y g:i A T') }}</td></tr>
            @endif
        </table>
    @else
        <div class="empty">No case file on record for this client.</div>
    @endif

  {{-- Section 2: Retainer agreement --}}
    <div class="section-title">2. Retainer agreement summary</div>
    @if($agreement)
        <table class="kv-table">
            <tr>
                <td>Agreement status</td>
                <td>
                    @if($agreement['signed_at'])
                        <span class="status-signed">Signed</span>
                        — {{ $agreement['signed_at']->timezone('America/Toronto')->format('M j, Y g:i A T') }}
                        @if($agreement['signed_via'])
                            ({{ $agreement['signed_via'] }})
                        @endif
                    @elseif($agreement['sent_at'])
                        <span class="status-pending">Sent, awaiting signature</span>
                        — sent {{ $agreement['sent_at']->timezone('America/Toronto')->format('M j, Y') }}
                    @else
                        <span class="status-pending">Not yet sent</span>
                    @endif
                </td>
            </tr>
            <tr><td>Total professional fee</td><td>{{ number_format($agreement['total_fee'], 2) }} {{ $agreement['currency'] }}</td></tr>
            @if($agreement['pathway'])
                <tr><td>Services pathway</td><td>{{ $agreement['pathway'] }}</td></tr>
            @endif
            @if($agreement['scope_description'])
                <tr><td>Scope of services</td><td>{{ $agreement['scope_description'] }}</td></tr>
            @endif
            <tr><td>Document deadline</td><td>{{ $agreement['doc_deadline_days'] }} days from agreement</td></tr>
            @if($agreement['signed_ip'])
                <tr><td>Signature IP address</td><td>{{ $agreement['signed_ip'] }}</td></tr>
            @endif
        </table>

        <div class="section-title" style="margin-top:10px; font-size:8px;">Fee milestones</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width:5%">#</th>
                    <th style="width:55%">Milestone</th>
                    <th style="width:15%">%</th>
                    <th style="width:25%">Amount</th>
                </tr>
            </thead>
            <tbody>
                @foreach($agreement['milestones'] as $i => $m)
                    <tr>
                        <td>{{ $i + 1 }}</td>
                        <td>{{ $m['label'] }}</td>
                        <td>{{ $m['percentage'] }}%</td>
                        <td>{{ number_format($m['amount'], 2) }} {{ $agreement['currency'] }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        @if($agreement['refund_policy'])
            <div class="section-title" style="margin-top:10px; font-size:8px;">Refund policy (summary)</div>
            <div class="text-block">{{ $agreement['refund_policy'] }}</div>
        @endif
    @else
        <div class="empty">No retainer agreement on record.</div>
    @endif

  {{-- Section 3: Trust account --}}
    <div class="section-title">3. Client trust account</div>
    @if($trust['account'])
        <table class="summary-row">
            <tr>
                <td>
                    <div class="num">{{ number_format($trust['account']['balance_held'], 2) }}</div>
                    <div class="lbl">Balance held ({{ $trust['account']['currency'] }})</div>
                </td>
                <td>
                    <div class="num">{{ number_format($trust['account']['total_deposited'], 2) }}</div>
                    <div class="lbl">Total deposited</div>
                </td>
                <td>
                    <div class="num">{{ number_format($trust['account']['total_released'], 2) }}</div>
                    <div class="lbl">Total released</div>
                </td>
                <td>
                    <div class="num">{{ number_format($trust['account']['total_refunded'], 2) }}</div>
                    <div class="lbl">Total refunded</div>
                </td>
            </tr>
        </table>

        @if(count($trust['milestones']) > 0)
            <div class="section-title" style="margin-top:10px; font-size:8px;">Milestone billing status</div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Milestone</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Completed</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($trust['milestones'] as $m)
                        <tr>
                            <td>{{ $m['label'] }}</td>
                            <td>{{ number_format($m['amount'], 2) }} {{ $m['currency'] }}</td>
                            <td>{{ str_replace('_', ' ', $m['status']) }}</td>
                            <td>{{ $m['completed_at'] ? \Carbon\Carbon::parse($m['completed_at'])->timezone('America/Toronto')->format('M j, Y') : '—' }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif

        <div class="section-title" style="margin-top:10px; font-size:8px;">Trust ledger entries</div>
        @if(count($trust['ledger']) > 0)
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width:14%">Date</th>
                        <th style="width:22%">Type</th>
                        <th style="width:12%">Amount</th>
                        <th style="width:12%">Balance after</th>
                        <th style="width:40%">Description</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($trust['ledger'] as $entry)
                        <tr>
                            <td>{{ \Carbon\Carbon::parse($entry['occurred_at'])->timezone('America/Toronto')->format('Y-m-d H:i') }}</td>
                            <td>{{ str_replace('_', ' ', $entry['entry_type']) }}</td>
                            <td>{{ $entry['direction'] === 'credit' ? '+' : '−' }}{{ number_format($entry['amount'], 2) }} {{ $entry['currency'] }}</td>
                            <td>{{ number_format($entry['balance_after'], 2) }}</td>
                            <td>{{ $entry['title'] }}{{ $entry['description'] ? ' — ' . $entry['description'] : '' }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @else
            <div class="empty">No trust ledger entries recorded.</div>
        @endif

        @if($trust['note'])
            <div class="footer-note" style="margin-top:8px;">{{ $trust['note'] }}</div>
        @endif
    @else
        <div class="empty">No trust account opened for this client (typically created after agreement is signed).</div>
    @endif

  {{-- Section 4: Documents --}}
    <div class="section-title page-break">4. Document inventory</div>
    @if($documents->isNotEmpty())
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width:22%">Type</th>
                    <th style="width:28%">Label / filename</th>
                    <th style="width:12%">Status</th>
                    <th style="width:18%">Uploaded</th>
                    <th style="width:20%">Reviewed</th>
                </tr>
            </thead>
            <tbody>
                @foreach($documents as $doc)
                    <tr>
                        <td>{{ $doc->document_type }}</td>
                        <td>{{ $doc->document_label ?: $doc->original_filename }}</td>
                        <td>{{ str_replace('_', ' ', $doc->status) }}</td>
                        <td>{{ $doc->created_at->timezone('America/Toronto')->format('M j, Y') }}</td>
                        <td>{{ $doc->reviewed_at ? $doc->reviewed_at->timezone('America/Toronto')->format('M j, Y') : '—' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @else
        <div class="empty">No documents uploaded for this case.</div>
    @endif

  {{-- Section 5: Activity log --}}
    <div class="section-title page-break">5. Portal activity audit log</div>

    <table class="summary-row">
        <tr>
            <td>
                <div class="num">{{ $totalActivityCount }}</div>
                <div class="lbl">Total events</div>
            </td>
            <td>
                <div class="num">{{ $clientActions }}</div>
                <div class="lbl">Client (in packet)</div>
            </td>
            <td>
                <div class="num">{{ $consultantActions }}</div>
                <div class="lbl">Consultant (in packet)</div>
            </td>
            <td>
                <div class="num">{{ $activityLogs->count() }}</div>
                <div class="lbl">Events in packet</div>
            </td>
        </tr>
    </table>

    @if($activityTruncated)
        <div class="truncate-note">
            Note: {{ $totalActivityCount }} total events on record. This packet includes the earliest {{ $activityLogs->count() }} events chronologically.
            Download the standalone activity report for filtered exports.
        </div>
    @endif

    @if($activityLogs->isEmpty())
        <div class="empty">No activity events recorded.</div>
    @else
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width:4%">#</th>
                    <th style="width:14%">Date &amp; time</th>
                    <th style="width:12%">Actor</th>
                    <th style="width:22%">Event</th>
                    <th style="width:38%">Description</th>
                    <th style="width:10%">IP</th>
                </tr>
            </thead>
            <tbody>
                @foreach($activityLogs as $i => $log)
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
        This compliance packet consolidates retainer agreement terms, trust account records, document inventory,
        and portal interaction logs maintained on RCICMASTER. It supports transparency and accountability
        obligations under the College of Immigration and Citizenship Consultants (CICC).
    </div>

    <div class="certification">
        <strong>Certification statement:</strong> This document was electronically generated from records maintained
        on the RCICMASTER platform (Report {{ $reportRef }}). Each section reflects data as recorded at the time of
        generation. Intended for professional, compliance, and dispute-resolution purposes.
    </div>

    <script type="text/php">
        if (isset($pdf)) {
            $pdf->page_text(32, 820, "RCICMASTER Compliance Packet · {{ $reportRef }}", null, 7, [0.4, 0.4, 0.4]);
            $pdf->page_text(480, 820, "Page {PAGE_NUM} of {PAGE_COUNT}", null, 7, [0.4, 0.4, 0.4]);
        }
    </script>
</body>
</html>

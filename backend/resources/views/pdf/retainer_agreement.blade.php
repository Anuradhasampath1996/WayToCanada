<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Retainer Agreement</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; line-height: 1.45; color: #1a1a1a; margin: 28px; }
        h1 { font-size: 15px; text-align: center; margin: 0; text-transform: uppercase; letter-spacing: 2px; }
        .muted { color: #555; }
        .section-title { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #1d4ed8; margin: 14px 0 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9px; }
        th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; }
        .right { text-align: right; }
        .header { border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 12px; }
        .logo { max-height: 64px; max-width: 88px; }
        .title-block { border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 12px 0; margin: 12px 0; text-align: center; }
        .meta { background: #f8fafc; border: 1px solid #ddd; padding: 8px; margin-top: 8px; }
        .meta td { border: none; padding: 2px 6px; }
        .signatures { border-top: 1px solid #ddd; margin-top: 16px; padding-top: 12px; }
        .sig-col { width: 48%; display: inline-block; vertical-align: top; }
        .sig-img { max-height: 44px; max-width: 160px; }
        ul { margin: 4px 0 4px 16px; padding: 0; }
        li { margin-bottom: 3px; }
        .prose p { margin: 3px 0; }
        .party-card { width: 48%; display: inline-block; vertical-align: top; border-top: 2px solid #1d4ed8; background: #f8fafc; padding: 8px; box-sizing: border-box; }
        .party-card + .party-card { margin-left: 2%; border-top-color: #444; }
        .party-label { color: #1d4ed8; font-size: 8px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
        .party-name { font-size: 11px; font-weight: bold; margin: 5px 0; }
        .party-row { margin: 2px 0; }
        .party-key { color: #666; display: inline-block; width: 82px; }
        .section-text { white-space: pre-line; }
    </style>
</head>
<body>
@php
    $details = $clientDetails ?? [];
    $displayClient = $details['fullLegalName'] ?? $clientName;
    $addressLines = collect([
        $consultantProfile['company_address_line1'] ?? null,
        $consultantProfile['company_address_line2'] ?? null,
        trim(implode(', ', array_filter([
            $consultantProfile['company_city'] ?? null,
            $consultantProfile['company_province'] ?? null,
            $consultantProfile['company_postal_code'] ?? null,
        ]))),
        $consultantProfile['company_country'] ?? null,
    ])->filter()->values();
    $sectionEdits = is_array($config['sectionEdits'] ?? null) ? $config['sectionEdits'] : [];
    $taxEnabled = (bool) ($config['taxEnabled'] ?? false) && (float) ($config['taxRate'] ?? 0) > 0;
    $taxLabel = $config['taxLabel'] ?? 'Tax';
    $taxRate = (float) ($config['taxRate'] ?? 0);
    $taxAmount = $taxEnabled ? round((float) $config['totalFee'] * $taxRate) / 100 : 0;
    $taxM1 = $taxEnabled ? round($m1 * $taxRate) / 100 : 0;
    $taxM2 = $taxEnabled ? round($m2 * $taxRate) / 100 : 0;
    $taxM3 = $taxEnabled ? round($m3 * $taxRate) / 100 : 0;
    $grandTotal = (float) $config['totalFee'] + $taxAmount;
@endphp

    <div class="header">
        <table style="border: none; margin-top: 0;">
            <tr>
                <td style="width: 90px; border: none; vertical-align: top; padding: 0 8px 0 0;">
                    @if($companyLogo)
                        <img src="{{ $companyLogo }}" alt="Logo" class="logo">
                    @endif
                </td>
                <td style="border: none; vertical-align: top; padding: 0 8px 0 0;">
                    <div style="font-size: 14px; font-weight: bold;">{{ $companyName ?: $consultantName }}</div>
                    <div class="muted" style="font-size: 8px; text-transform: uppercase; letter-spacing: 1px;">Regulated Canadian Immigration Consultant</div>
                    @if($companyName && $consultantName && $companyName !== $consultantName)
                        <div style="font-size: 9px; margin-top: 2px;">{{ $consultantName }}</div>
                    @endif
                </td>
                <td style="border: none; vertical-align: top; text-align: right; width: 38%; padding: 0;">
                    @foreach($addressLines as $line)
                        <div>{{ $line }}</div>
                    @endforeach
                    @if($companyPhone)<div>Tel: {{ $companyPhone }}</div>@endif
                    @if(!empty($consultantProfile['email']))<div>Email: {{ $consultantProfile['email'] }}</div>@endif
                    @if($companyWeb)<div>Web: {{ preg_replace('#^https?://#', '', $companyWeb) }}</div>@endif
                    @if($rcicNo)<div style="font-weight: bold; margin-top: 4px;">RCIC Licence No. {{ $rcicNo }}</div>@endif
                </td>
            </tr>
        </table>

        <div class="title-block">
            <h1>Retainer Agreement</h1>
            <div class="muted" style="font-size: 8px; text-transform: uppercase; margin-top: 4px;">For professional immigration consulting services</div>
            <div style="margin-top: 6px;">Effective date: <strong>{{ $docDate }}</strong>
                @if(!empty($details['caseReference'])) · File ref. {{ $details['caseReference'] }} @endif
            </div>
        </div>

        <table class="meta">
            <tr>
                <td><span class="muted">Client:</span> <strong>{{ $displayClient ?: '—' }}</strong></td>
                <td><span class="muted">Pathway:</span> <strong>{{ $pathway ?: '—' }}</strong></td>
                <td><span class="muted">Consultant:</span> <strong>{{ $consultantName ?: '—' }}</strong></td>
            </tr>
        </table>
    </div>

    <div class="section-title">1. Parties to this Agreement</div>
    @if(!empty($sectionEdits['parties']))
        <div class="section-text">{!! $sectionEdits['parties'] !!}</div>
    @else
        <p>This Retainer Agreement is made effective as of <strong>{{ $docDate }}</strong> between the parties identified below.</p>
        <div>
            <div class="party-card">
                <div class="party-label">Immigration Consultant</div>
                <div class="party-name">{{ $consultantName ?: '[Consultant Name]' }}</div>
                @if($companyName && $companyName !== $consultantName)<div>{{ $companyName }}</div>@endif
                @if($rcicNo)<div class="party-row"><span class="party-key">RCIC licence</span>{{ $rcicNo }}</div>@endif
                @if(!empty($consultantProfile['email']))<div class="party-row"><span class="party-key">Email</span>{{ $consultantProfile['email'] }}</div>@endif
                @if($companyPhone)<div class="party-row"><span class="party-key">Telephone</span>{{ $companyPhone }}</div>@endif
                @if($companyAddress)<div class="party-row"><span class="party-key">Address</span>{{ $companyAddress }}</div>@endif
            </div><div class="party-card">
                <div class="party-label" style="color:#444;">Client</div>
                <div class="party-name">{{ $displayClient ?: '[Client Full Legal Name]' }}</div>
                @if(!empty($details['email'] ?? $clientEmail))<div class="party-row"><span class="party-key">Email</span>{{ $details['email'] ?? $clientEmail }}</div>@endif
                @if(!empty($details['phone']))<div class="party-row"><span class="party-key">Telephone</span>{{ $details['phone'] }}</div>@endif
                @if(!empty($details['residentialAddress']))<div class="party-row"><span class="party-key">Address</span>{{ $details['residentialAddress'] }}</div>@endif
            </div>
        </div>
    @endif

    <div class="section-title">2. Scope of Services</div>
    @if(!empty($sectionEdits['scope']))
        <div class="section-text">{!! $sectionEdits['scope'] !!}</div>
    @else
        <p>Services relate to the immigration pathway: <strong>{{ $pathway ?: '[Pathway]' }}</strong>.</p>
        @if($scopeText)<p>{{ $scopeText }}</p>@endif
    @endif

    <div class="section-title">3. Professional Fees &amp; Payment Milestones</div>
    @if(!empty($sectionEdits['fees']))
        <div class="section-text">{!! $sectionEdits['fees'] !!}</div>
    @else
        <p>Total professional fee: <strong>{{ $fmt($config['totalFee']) }}</strong> ({{ $config['currency'] }}), exclusive of taxes and government fees.</p>
        <table>
            <thead><tr><th>Milestone</th><th>Trigger</th>@if($taxEnabled)<th class="right">Tax</th>@endif<th class="right">Amount due</th></tr></thead>
            <tbody>
                <tr><td>1 ({{ $config['milestone1Pct'] }}%)</td><td>{{ $config['milestone1Label'] }}</td>@if($taxEnabled)<td class="right">{{ $fmt($taxM1) }}</td>@endif<td class="right">{{ $fmt($m1 + $taxM1) }}</td></tr>
                <tr><td>2 ({{ $config['milestone2Pct'] }}%)</td><td>{{ $config['milestone2Label'] }}</td>@if($taxEnabled)<td class="right">{{ $fmt($taxM2) }}</td>@endif<td class="right">{{ $fmt($m2 + $taxM2) }}</td></tr>
                <tr><td>3 ({{ $config['milestone3Pct'] }}%)</td><td>{{ $config['milestone3Label'] }}</td>@if($taxEnabled)<td class="right">{{ $fmt($taxM3) }}</td>@endif<td class="right">{{ $fmt($m3 + $taxM3) }}</td></tr>
            </tbody>
        </table>
        <p class="muted">Any advance payment will be handled in accordance with applicable CICC requirements. Only fees earned under the agreed milestones may be treated as earned fees.</p>
        @if($taxEnabled)
            <div style="border-top:1px solid #ddd; margin-top:7px; padding-top:6px;">
                <div>Professional fee: <strong>{{ $fmt($config['totalFee']) }}</strong></div>
                <div>{{ $taxLabel }} ({{ $taxRate }}%): <strong>{{ $fmt($taxAmount) }}</strong></div>
                <div style="border-top:1px solid #ddd; margin-top:3px; padding-top:3px;"><strong>Total amount payable: {{ $fmt($grandTotal) }}</strong></div>
                <div class="muted">Tax is calculated on the professional fee and charged proportionally with each milestone payment.</div>
            </div>
        @endif
    @endif

    <div class="section-title">4. Government &amp; Third-Party Fees</div>
    @if(!empty($sectionEdits['governmentFees']))
        <div class="section-text">{!! $sectionEdits['governmentFees'] !!}</div>
    @else
        <p>Government fees, biometrics, medicals, language tests, translations, and third-party costs are not included unless expressly stated in writing.</p>
    @endif

    <div class="section-title">5. Client Obligations</div>
    @if(!empty($sectionEdits['clientObligations']))
        <div class="section-text">{!! $sectionEdits['clientObligations'] !!}</div>
    @else
        <ul>
            <li>Provide complete and genuine documents within <strong>{{ $config['docDeadlineDays'] }} calendar days</strong> of request.</li>
            <li>Disclose material changes in circumstances promptly.</li>
            <li>Fraudulent or misrepresented documents void this Agreement without refund.</li>
        </ul>
    @endif

    <div class="section-title">6. Consultant Obligations</div>
    @if(!empty($sectionEdits['consultantObligations']))
        <div class="section-text">{!! $sectionEdits['consultantObligations'] !!}</div>
    @else
        <ul>
            <li>Perform services diligently and in accordance with the CICC Code of Professional Ethics.</li>
            <li>Maintain a client file and safeguard Client information.</li>
        </ul>
    @endif

    <div class="section-title">7. No Guarantee of Outcome</div>
    @if(!empty($sectionEdits['outcome']))
        <div class="section-text">{!! $sectionEdits['outcome'] !!}</div>
    @else
        <p>The Consultant does not guarantee approval of any application. Final decisions rest with IRCC or other authorities.</p>
    @endif

    <div class="section-title">8. Termination</div>
    @if(!empty($sectionEdits['termination']))
        <div class="section-text">{!! $sectionEdits['termination'] !!}</div>
    @else
        <p>Either party may terminate in writing. Fees for work completed remain payable.</p>
    @endif

    <div class="section-title">9. Confidentiality &amp; Privacy</div>
    @if(!empty($sectionEdits['privacy']))
        <div class="section-text">{!! $sectionEdits['privacy'] !!}</div>
    @else
        <p>Personal information is handled in accordance with applicable privacy legislation, including PIPEDA where applicable.</p>
    @endif

    <div class="section-title">10. Refund Policy</div>
    @if(!empty($sectionEdits['refund']))
        <div class="section-text">{!! $sectionEdits['refund'] !!}</div>
    @else
        <div class="prose">{!! $config['refundPolicy'] !!}</div>
    @endif

    <div class="section-title">11. Regulatory Compliance &amp; Dispute Resolution</div>
    @if(!empty($sectionEdits['regulatory']))
        <div class="section-text">{!! $sectionEdits['regulatory'] !!}</div>
    @else
        <p>Complaints may be filed with the College of Immigration and Citizenship Consultants (CICC) at college-ic.ca.</p>
    @endif

    <div class="section-title">12. General Provisions</div>
    @if(!empty($sectionEdits['general']))
        <div class="section-text">{!! $sectionEdits['general'] !!}</div>
    @else
        <ul>
            <li>This Agreement constitutes the entire agreement between the parties.</li>
            <li>Amendments must be in writing and signed by both parties.</li>
            <li>This Agreement is governed by the laws of Canada and the province in which the Consultant primarily practises.</li>
        </ul>
    @endif

    @if(!empty($sectionEdits['custom']) || (!empty($config['customClauses']) && trim(strip_tags($config['customClauses'])) !== ''))
        <div class="section-title">13. Additional Terms</div>
        @if(!empty($sectionEdits['custom']))
            <div class="section-text">{!! $sectionEdits['custom'] !!}</div>
        @else
            <div class="prose">{!! $config['customClauses'] !!}</div>
        @endif
    @endif

    <div class="signatures">
        <div class="section-title">Signatures</div>
        <p class="muted">By signing, each party agrees to be bound by this Agreement.</p>
        <div class="sig-col">
            <p><strong>Immigration Consultant</strong></p>
            @if($digitalSignature)
                <img src="{{ $digitalSignature }}" alt="Consultant signature" class="sig-img">
            @else
                <div style="border-bottom: 1px dashed #999; height: 24px; margin-bottom: 4px;"></div>
            @endif
            <p>{{ $consultantName }}</p>
            @if($rcicNo)<p class="muted">RCIC No. {{ $rcicNo }}</p>@endif
            <p class="muted">Date: {{ $docDate }}</p>
        </div>
        <div class="sig-col" style="margin-left: 2%;">
            <p><strong>Client</strong></p>
            @if($clientSignature)
                <img src="{{ $clientSignature }}" alt="Client signature" class="sig-img">
            @else
                <div style="border-bottom: 1px dashed #999; height: 24px; margin-bottom: 4px;"></div>
            @endif
            <p>{{ $displayClient }}</p>
            <p class="muted">Date: {{ $signedDate ?? '___________' }}</p>
        </div>
    </div>
</body>
</html>

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
    <p>This Retainer Agreement is made effective as of <strong>{{ $docDate }}</strong> between the parties identified below.</p>
    <table>
        <thead>
            <tr><th>Detail</th><th>Immigration Consultant</th><th>Client</th></tr>
        </thead>
        <tbody>
            <tr><td>Full legal name</td><td>{{ $consultantName ?: '—' }}</td><td>{{ $displayClient ?: '—' }}</td></tr>
            <tr><td>RCIC licence no.</td><td>{{ $rcicNo ?: '—' }}</td><td>—</td></tr>
            <tr><td>Email</td><td>{{ $consultantProfile['email'] ?? '—' }}</td><td>{{ $details['email'] ?? $clientEmail ?: '—' }}</td></tr>
            <tr><td>Telephone</td><td>{{ $companyPhone ?: '—' }}</td><td>{{ $details['phone'] ?? '—' }}</td></tr>
            <tr><td>Residential address</td><td>{{ $companyAddress ?: '—' }}</td><td>{{ $details['residentialAddress'] ?? '—' }}</td></tr>
            <tr><td>Date of birth</td><td>—</td><td>{{ $details['dateOfBirth'] ?? '—' }}</td></tr>
            <tr><td>Passport / travel document no.</td><td>—</td><td>{{ $details['passportNumber'] ?? '—' }}</td></tr>
            <tr><td>Country of citizenship</td><td>—</td><td>{{ $details['citizenship'] ?? '—' }}</td></tr>
        </tbody>
    </table>

    <div class="section-title">2. Scope of Services</div>
    <p>Services relate to the immigration pathway: <strong>{{ $pathway ?: '[Pathway]' }}</strong>.</p>
    @if($scopeText)<p>{{ $scopeText }}</p>@endif

    <div class="section-title">3. Professional Fees &amp; Payment Milestones</div>
    <p>Total professional fee: <strong>{{ $fmt($config['totalFee']) }}</strong> ({{ $config['currency'] }}), exclusive of taxes and government fees.</p>
    <table>
        <thead><tr><th>Milestone</th><th>Trigger</th><th class="right">Amount</th></tr></thead>
        <tbody>
            <tr><td>1 ({{ $config['milestone1Pct'] }}%)</td><td>{{ $config['milestone1Label'] }}</td><td class="right">{{ $fmt($m1) }}</td></tr>
            <tr><td>2 ({{ $config['milestone2Pct'] }}%)</td><td>{{ $config['milestone2Label'] }}</td><td class="right">{{ $fmt($m2) }}</td></tr>
            <tr><td>3 ({{ $config['milestone3Pct'] }}%)</td><td>{{ $config['milestone3Label'] }}</td><td class="right">{{ $fmt($m3) }}</td></tr>
        </tbody>
    </table>

    <div class="section-title">4. Government &amp; Third-Party Fees</div>
    <p>Government fees, biometrics, medicals, language tests, translations, and third-party costs are not included unless expressly stated in writing.</p>

    <div class="section-title">5. Client Obligations</div>
    <ul>
        <li>Provide complete and genuine documents within <strong>{{ $config['docDeadlineDays'] }} calendar days</strong> of request.</li>
        <li>Disclose material changes in circumstances promptly.</li>
        <li>Fraudulent or misrepresented documents void this Agreement without refund.</li>
    </ul>

    <div class="section-title">6. Consultant Obligations</div>
    <ul>
        <li>Perform services diligently and in accordance with the CICC Code of Professional Ethics.</li>
        <li>Maintain a client file and safeguard Client information.</li>
    </ul>

    <div class="section-title">7. No Guarantee of Outcome</div>
    <p>The Consultant does not guarantee approval of any application. Final decisions rest with IRCC or other authorities.</p>

    <div class="section-title">8. Termination</div>
    <p>Either party may terminate in writing. Fees for work completed remain payable.</p>

    <div class="section-title">9. Confidentiality &amp; Privacy</div>
    <p>Personal information is handled in accordance with applicable privacy legislation, including PIPEDA where applicable.</p>

    <div class="section-title">10. Refund Policy</div>
    <div class="prose">{!! $config['refundPolicy'] !!}</div>

    <div class="section-title">11. Regulatory Compliance &amp; Dispute Resolution</div>
    <p>Complaints may be filed with the College of Immigration and Citizenship Consultants (CICC) at college-ic.ca.</p>

    <div class="section-title">12. General Provisions</div>
    <ul>
        <li>This Agreement constitutes the entire agreement between the parties.</li>
        <li>Amendments must be in writing and signed by both parties.</li>
        <li>This Agreement is governed by the laws of Canada and the province in which the Consultant primarily practises.</li>
    </ul>

    @if(!empty($config['customClauses']) && trim(strip_tags($config['customClauses'])) !== '')
        <div class="section-title">13. Additional Terms</div>
        <div class="prose">{!! $config['customClauses'] !!}</div>
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

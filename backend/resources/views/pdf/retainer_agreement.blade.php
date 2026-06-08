<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Retainer Agreement</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; line-height: 1.5; color: #1a1a1a; margin: 32px; }
        h1 { font-size: 16px; text-align: center; margin: 0 0 4px; text-transform: uppercase; }
        .muted { color: #666; }
        .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #1d4ed8; margin: 18px 0 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f3f4f6; }
        .right { text-align: right; }
        .header { border-bottom: 1px solid #ddd; padding-bottom: 14px; margin-bottom: 14px; }
        .header-top { margin-bottom: 10px; }
        .logo { max-height: 56px; max-width: 120px; }
        .signatures { border-top: 1px solid #ddd; margin-top: 20px; padding-top: 14px; }
        .sig-col { width: 48%; display: inline-block; vertical-align: top; }
        .sig-img { max-height: 48px; max-width: 180px; }
        ul { margin: 6px 0 6px 18px; padding: 0; }
        li { margin-bottom: 4px; }
        .prose p { margin: 4px 0; }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-top">
            @if($companyLogo)
                <img src="{{ $companyLogo }}" alt="Logo" class="logo">
            @endif
            @if($companyName)
                <div style="font-weight: bold; font-size: 13px;">{{ $companyName }}</div>
            @endif
            @if($companyAddress)
                <div class="muted">{{ $companyAddress }}</div>
            @endif
            @if($companyPhone)
                <div class="muted">{{ $companyPhone }}</div>
            @endif
            @if(!empty($consultantProfile['email']))
                <div class="muted">{{ $consultantProfile['email'] }}</div>
            @endif
            @if($companyWeb)
                <div class="muted">{{ $companyWeb }}</div>
            @endif
            @if($rcicNo)
                <div class="muted">RCIC License No. {{ $rcicNo }}</div>
            @endif
        </div>
        <h1>Retainer Agreement</h1>
        <p class="muted" style="text-align:center; margin:0;">Date: {{ $docDate }}</p>
    </div>

    <div class="section-title">1. Parties to this Agreement</div>
    <p>This Retainer Agreement ("Agreement") is entered into between:</p>
    <ul>
        <li>
            <strong>Immigration Consultant:</strong> {{ $consultantName ?: '[Consultant Name]' }}
            @if($rcicNo), RCIC License No. {{ $rcicNo }}@endif, registered with the College of Immigration and Citizenship Consultants (CICC).
            @if($companyName && $companyName !== $consultantName)
                , practising as <strong>{{ $companyName }}</strong>
            @endif
        </li>
        <li>
            <strong>Client:</strong> {{ $clientName ?: '[Client Full Name]' }}
            @if($clientEmail) ({{ $clientEmail }}) @endif
        </li>
    </ul>

    <div class="section-title">2. Scope of Services</div>
    <p>
        The Consultant agrees to provide professional immigration consulting services for the client's
        immigration pathway: <strong>{{ $pathway ?: '[Pathway]' }}</strong>.
    </p>
    @if($scopeText)
        <p>{{ $scopeText }}</p>
    @endif
    <p class="muted" style="font-style: italic;">Any services outside the scope defined above will require a separate written agreement.</p>

    <div class="section-title">3. Professional Fees &amp; Payment Milestones</div>
    <p>
        The total professional fee is <strong>{{ $fmt($config['totalFee']) }}</strong> ({{ $config['currency'] }}),
        payable in three milestones:
    </p>
    <table>
        <thead>
            <tr>
                <th>Milestone</th>
                <th>Trigger</th>
                <th class="right">Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>1 ({{ $config['milestone1Pct'] }}%)</td>
                <td>{{ $config['milestone1Label'] }}</td>
                <td class="right">{{ $fmt($m1) }}</td>
            </tr>
            <tr>
                <td>2 ({{ $config['milestone2Pct'] }}%)</td>
                <td>{{ $config['milestone2Label'] }}</td>
                <td class="right">{{ $fmt($m2) }}</td>
            </tr>
            <tr>
                <td>3 ({{ $config['milestone3Pct'] }}%)</td>
                <td>{{ $config['milestone3Label'] }}</td>
                <td class="right">{{ $fmt($m3) }}</td>
            </tr>
        </tbody>
    </table>

    <div class="section-title">4. Client Obligations</div>
    <ul>
        <li>Provide all required genuine documents within <strong>{{ $config['docDeadlineDays'] }} calendar days</strong> of request.</li>
        <li>Inform the Consultant immediately of any changes to personal circumstances.</li>
        <li>Providing fraudulent, altered, or misrepresented documents immediately voids this Agreement without refund.</li>
        <li>The Client assumes full responsibility for the accuracy and authenticity of all submitted documents.</li>
    </ul>

    <div class="section-title">5. Refund Policy</div>
    <div class="prose">{!! $config['refundPolicy'] !!}</div>

    <div class="section-title">6. Regulatory Compliance</div>
    <p>
        The Consultant is a regulated professional bound by the CICC Code of Professional Ethics and By-Laws.
        Any disputes may be escalated to the College of Immigration and Citizenship Consultants (CICC) at cicc.ca.
    </p>

    @if(!empty($config['customClauses']) && trim(strip_tags($config['customClauses'])) !== '')
        <div class="section-title">7. Additional Terms</div>
        <div class="prose">{!! $config['customClauses'] !!}</div>
    @endif

    <div class="signatures">
        <div class="section-title">Signatures</div>
        <div class="sig-col">
            <p><strong>Immigration Consultant</strong></p>
            @if($digitalSignature)
                <img src="{{ $digitalSignature }}" alt="Consultant signature" class="sig-img">
            @else
                <div style="border-bottom: 1px dashed #999; height: 28px; margin-bottom: 6px;"></div>
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
                <div style="border-bottom: 1px dashed #999; height: 28px; margin-bottom: 6px;"></div>
            @endif
            <p>{{ $clientName }}</p>
            <p class="muted">Date: {{ $signedDate ?? '___________' }}</p>
        </div>
    </div>
</body>
</html>

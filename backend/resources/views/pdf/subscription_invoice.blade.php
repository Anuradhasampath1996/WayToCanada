<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Tax Invoice {{ $invoiceNumber }}</title>
    <style>
        @page { margin: 28px 32px 36px 32px; }
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
        .header-table { width: 100%; border-collapse: collapse; }
        .header-table td { vertical-align: top; padding: 0; }
        .logo { max-height: 54px; max-width: 150px; margin-bottom: 6px; }
        .company-name { font-size: 14px; font-weight: bold; color: #1e3a5f; margin: 0 0 2px; }
        .company-trade { font-size: 10px; color: #374151; margin: 0 0 6px; }
        .doc-title {
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #1e3a5f;
            margin: 0 0 2px;
            text-align: right;
        }
        .doc-subtitle { font-size: 9px; color: #374151; margin: 0; text-align: right; }
        .status-paid {
            display: inline-block;
            margin-top: 8px;
            padding: 4px 10px;
            background: #ecfdf5;
            border: 1px solid #6ee7b7;
            color: #047857;
            font-size: 9px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }
        .meta-box {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
        }
        .meta-box td {
            padding: 8px 10px;
            border-right: 1px solid #e5e7eb;
            vertical-align: top;
            width: 25%;
        }
        .meta-box td:last-child { border-right: none; }
        .meta-label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.35px;
            color: #6b7280;
            margin-bottom: 3px;
        }
        .meta-value { font-size: 10px; font-weight: bold; color: #111827; }
        .parties {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
        }
        .parties th {
            background: #1e3a5f;
            color: #fff;
            font-size: 8.5px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            padding: 7px 10px;
            text-align: left;
        }
        .parties td {
            border: 1px solid #d1d5db;
            padding: 10px;
            vertical-align: top;
            width: 50%;
        }
        .party-line { margin-bottom: 3px; font-size: 9.5px; }
        .party-line strong { font-size: 10px; }
        .section-title {
            font-size: 8.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.35px;
            color: #1e3a5f;
            margin: 0 0 6px;
        }
        table.items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }
        table.items th {
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            padding: 7px 8px;
            font-size: 8px;
            text-transform: uppercase;
            color: #374151;
            text-align: left;
        }
        table.items td {
            border: 1px solid #d1d5db;
            padding: 8px;
            font-size: 9.5px;
            vertical-align: top;
        }
        .right { text-align: right; }
        .center { text-align: center; }
        table.totals {
            width: 280px;
            margin-left: auto;
            border-collapse: collapse;
        }
        table.totals td {
            padding: 5px 0;
            font-size: 9.5px;
        }
        table.totals tr.subtotal td { border-top: 1px solid #d1d5db; padding-top: 8px; }
        table.totals tr.total td {
            border-top: 2px solid #1e3a5f;
            font-weight: bold;
            font-size: 11px;
            padding-top: 8px;
            color: #1e3a5f;
        }
        .tax-note {
            margin-top: 12px;
            padding: 8px 10px;
            background: #fffbeb;
            border: 1px solid #fde68a;
            font-size: 8.5px;
            color: #92400e;
        }
        .legal-box {
            margin-top: 14px;
            padding: 10px;
            border: 1px solid #e5e7eb;
            background: #fafafa;
            font-size: 8px;
            color: #4b5563;
        }
        .footer {
            margin-top: 16px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            font-size: 8px;
            color: #6b7280;
        }
        .reg-table { width: 100%; margin-top: 6px; border-collapse: collapse; }
        .reg-table td { padding: 2px 8px 2px 0; vertical-align: top; width: 50%; }
    </style>
</head>
<body>
    {{-- Header --}}
    <div class="header">
        <table class="header-table">
            <tr>
                <td style="width: 58%;">
                    @if($companyLogo)
                        <img src="{{ $companyLogo }}" alt="Logo" class="logo">
                    @endif
                    <div class="company-name">{{ $company->legal_name ?: ($company->trade_name ?: 'RCICMASTER') }}</div>
                    @if($company->trade_name && $company->legal_name && $company->trade_name !== $company->legal_name)
                        <div class="company-trade">Trading as {{ $company->trade_name }}</div>
                    @endif
                    @foreach($companyLines as $line)
                        @if($loop->first && ($company->legal_name || $company->trade_name) && str_contains($line, $company->legal_name ?? ''))
                            @continue
                        @endif
                        <div class="muted">{{ $line }}</div>
                    @endforeach
                    @if($company->phone)
                        <div class="muted" style="margin-top:4px;">Tel: {{ $company->phone }}</div>
                    @endif
                    @if($company->billing_email)
                        <div class="muted">{{ $company->billing_email }}</div>
                    @endif
                    @if($company->website)
                        <div class="muted">{{ $company->website }}</div>
                    @endif
                </td>
                <td style="width: 42%;">
                    <div class="doc-title">Tax Invoice</div>
                    <div class="doc-subtitle">Facture de taxes</div>
                    <div style="text-align:right; margin-top:10px;">
                        <span class="status-paid">Paid / Payée</span>
                    </div>
                </td>
            </tr>
        </table>
    </div>

    {{-- Invoice meta --}}
    <table class="meta-box">
        <tr>
            <td>
                <div class="meta-label">Invoice number</div>
                <div class="meta-value">{{ $invoiceNumber }}</div>
            </td>
            <td>
                <div class="meta-label">Invoice date</div>
                <div class="meta-value">{{ $paidAt }}</div>
            </td>
            <td>
                <div class="meta-label">Place of supply</div>
                <div class="meta-value">{{ $placeOfSupply }}</div>
            </td>
            <td>
                <div class="meta-label">Payment method</div>
                <div class="meta-value">Credit card (Stripe)</div>
            </td>
        </tr>
    </table>

    {{-- Supplier & Bill To --}}
    <table class="parties">
        <tr>
            <th>Supplier / Fournisseur</th>
            <th>Bill to / Facturer à</th>
        </tr>
        <tr>
            <td>
                <div class="party-line"><strong>{{ $company->legal_name ?: $company->trade_name }}</strong></div>
                @if($company->address_line1)<div class="party-line">{{ $company->address_line1 }}</div>@endif
                @if($company->address_line2)<div class="party-line">{{ $company->address_line2 }}</div>@endif
                <div class="party-line">
                    {{ trim(implode(', ', array_filter([$company->city, $company->province, $company->postal_code]))) }}
                </div>
                <div class="party-line">Canada</div>
                @if($company->gst_hst_number)
                    <div class="party-line" style="margin-top:6px;"><strong>GST/HST No.:</strong> {{ $company->gst_hst_number }}</div>
                @endif
                @if($company->business_number)
                    <div class="party-line"><strong>Business No. (BN):</strong> {{ $company->business_number }}</div>
                @endif
            </td>
            <td>
                @foreach($billToLines as $line)
                    <div class="party-line">{{ $loop->first ? '' : '' }}{{ $loop->first ? '' : '' }}@if($loop->first)<strong>{{ $line }}</strong>@else{{ $line }}@endif</div>
                @endforeach
            </td>
        </tr>
    </table>

    {{-- Line items --}}
    <div class="section-title">Subscription charges</div>
    <table class="items">
        <thead>
            <tr>
                <th style="width:46%;">Description</th>
                <th class="center" style="width:10%;">Qty</th>
                <th class="right" style="width:18%;">Unit price</th>
                <th class="right" style="width:18%;">Amount ({{ $currency }})</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>
                    <strong>{{ $packageName }}</strong>
                    @if($packageDesc)
                        <br><span class="muted">{{ $packageDesc }}</span>
                    @endif
                    <br><span class="muted">{{ $paymentType }} · {{ $billingCycle }} subscription</span>
                </td>
                <td class="center">1</td>
                <td class="right">${{ number_format((float) $record->subtotal, 2) }}</td>
                <td class="right">${{ number_format((float) $record->subtotal, 2) }}</td>
            </tr>
        </tbody>
    </table>

    {{-- Totals --}}
    <table class="totals">
        <tr class="subtotal">
            <td>Subtotal</td>
            <td class="right">${{ number_format((float) $record->subtotal, 2) }}</td>
        </tr>
        @if($record->tax_applicable && (float) $record->tax_amount > 0)
            @if((float) ($record->gst_amount ?? 0) > 0)
                <tr>
                    <td>GST (5%)</td>
                    <td class="right">${{ number_format((float) $record->gst_amount, 2) }}</td>
                </tr>
            @endif
            @if((float) ($record->provincial_tax ?? 0) > 0)
                <tr>
                    <td>{{ $record->tax_type === 'gst_qst' ? 'QST' : 'Provincial tax' }}</td>
                    <td class="right">${{ number_format((float) $record->provincial_tax, 2) }}</td>
                </tr>
            @endif
            @if((float) ($record->gst_amount ?? 0) <= 0 && (float) ($record->provincial_tax ?? 0) <= 0)
                <tr>
                    <td>{{ $record->tax_label ?? 'Sales tax' }}@if($record->province) ({{ $record->province }})@endif</td>
                    <td class="right">${{ number_format((float) $record->tax_amount, 2) }}</td>
                </tr>
            @endif
        @else
            <tr>
                <td>Sales tax</td>
                <td class="right">$0.00</td>
            </tr>
        @endif
        <tr class="total">
            <td>Total due / Total dû</td>
            <td class="right">${{ number_format((float) $record->total, 2) }} {{ $currency }}</td>
        </tr>
    </table>

    @if(!$record->tax_applicable || (float) $record->tax_amount <= 0)
        <div class="tax-note">
            Zero-rated export — no Canadian GST/HST charged. Recipient located outside Canada (CRA place-of-supply rules, ETA s. 143).
        </div>
    @endif

    {{-- Registration & legal --}}
    <div class="legal-box">
        <strong>Tax registration &amp; legal information</strong>
        <table class="reg-table">
            <tr>
                @if($company->business_number)
                    <td><strong>Business Number (BN):</strong> {{ $company->business_number }}</td>
                @endif
                @if($company->gst_hst_number)
                    <td><strong>GST/HST Registration No.:</strong> {{ $company->gst_hst_number }}</td>
                @endif
            </tr>
            @if($company->qst_number || $company->pst_number)
                <tr>
                    @if($company->qst_number)
                        <td><strong>QST No.:</strong> {{ $company->qst_number }}</td>
                    @endif
                    @if($company->pst_number)
                        <td><strong>PST No.:</strong> {{ $company->pst_number }}</td>
                    @endif
                </tr>
            @endif
        </table>
        @if($company->invoice_footer)
            <div style="margin-top:8px;">{{ $company->invoice_footer }}</div>
        @else
            <div style="margin-top:8px;">
                This document serves as an official tax invoice for Canadian sales tax purposes.
                Amount shown as paid on {{ $paidAt }}. Retain for your records and CRA compliance.
            </div>
        @endif
    </div>

    <div class="footer">
        {{ $company->trade_name ?: 'RCICMASTER' }}
        @if($record->stripe_invoice_id) · Transaction ref: {{ $record->stripe_invoice_id }} @endif
        · Generated {{ $paidAtIso }}
        @if($company->support_email) · Questions: {{ $company->support_email }} @endif
    </div>
</body>
</html>
